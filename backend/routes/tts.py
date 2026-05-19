"""
TTS HTTP 端点 - 供前端页面直接调用，将文本合成为 base64 PCM 音频。
使用 qwen3-tts-instruct-flash-realtime，支持 instructions 指令控制。
"""
from fastapi import APIRouter, HTTPException, Depends, WebSocket, WebSocketDisconnect, Query
from pydantic import BaseModel
from typing import Optional
import base64
import asyncio
import threading
import logging

from auth_utils import get_current_user, decode_jwt_token
from storage import find_one, read_settings
from . import llm as llm_module

logger = logging.getLogger(__name__)
router = APIRouter()

DASHSCOPE_WS_URL = "wss://dashscope.aliyuncs.com/api-ws/v1/realtime"
TTS_MODEL = "qwen3-tts-instruct-flash-realtime"
TTS_VOICE = "Cherry"
TTS_SPEED_PROFILES = {
    "slow": {
        "rate": 0.92,
        "instructions": "请保持语速偏慢，吐字清晰，停顿自然，适合长者收听。",
    },
    "standard": {
        "rate": 1.08,
        "instructions": "请保持语速适中略偏快，吐字清晰自然，听感轻松明快。",
    },
    "fast": {
        "rate": 1.2,
        "instructions": "请保持语速偏快但清晰，整体更有活力，不要拖沓。",
    },
}


class SpeakReq(BaseModel):
    text: str
    instructions: Optional[str] = None  # 指令控制，如"语速稍慢，温和亲切"


def _send_threadsafe(loop: asyncio.AbstractEventLoop, ws: WebSocket, payload: dict):
    try:
        asyncio.run_coroutine_threadsafe(ws.send_json(payload), loop)
    except Exception:
        pass


def _get_tts_speed_profile():
    settings = read_settings()
    profile = settings.get("tts_speed_profile", "standard")
    return profile, TTS_SPEED_PROFILES.get(profile, TTS_SPEED_PROFILES["standard"])


def _merge_tts_instructions(custom_instructions: Optional[str]) -> str:
    _, speed_config = _get_tts_speed_profile()
    parts = []
    if custom_instructions:
        parts.append(custom_instructions.strip())
    parts.append(speed_config["instructions"])
    return " ".join(part for part in parts if part).strip()


def _build_session_params(mode: str, response_format, custom_instructions: Optional[str]):
    _, speed_config = _get_tts_speed_profile()
    session_params = dict(
        voice=TTS_VOICE,
        response_format=response_format,
        mode=mode,
        rate=speed_config["rate"],
    )
    merged_instructions = _merge_tts_instructions(custom_instructions)
    if merged_instructions:
        session_params["instructions"] = merged_instructions
        session_params["optimize_instructions"] = True
    return session_params


@router.post("/speak")
def speak(req: SpeakReq, user=Depends(get_current_user)):
    """将文本合成为语音，返回 base64 编码的 24kHz PCM 音频。"""
    text = (req.text or "").strip()
    if not text:
        raise HTTPException(400, "文本不能为空")
    if len(text) > 500:
        text = text[:500]  # 限制长度，避免超时

    api_key = llm_module._get_api_key(None)
    if not api_key:
        raise HTTPException(503, "TTS 服务未配置 API Key")

    audio_chunks = []
    complete_event = threading.Event()
    error_holder = [None]

    try:
        import dashscope
        from dashscope.audio.qwen_tts_realtime import QwenTtsRealtime, QwenTtsRealtimeCallback, AudioFormat

        class _CB(QwenTtsRealtimeCallback):
            def on_open(self): pass
            def on_close(self, code, msg):
                complete_event.set()
            def on_event(self, response):
                try:
                    et = response.get('type', '')
                    if et == 'response.audio.delta':
                        b64 = response.get('delta', '')
                        if b64:
                            audio_chunks.append(base64.b64decode(b64))
                    elif et == 'session.finished':
                        complete_event.set()
                except Exception as e:
                    error_holder[0] = str(e)
                    complete_event.set()

        dashscope.api_key = api_key
        cb = _CB()
        tts = QwenTtsRealtime(model=TTS_MODEL, callback=cb, url=DASHSCOPE_WS_URL)
        tts.connect()

        session_params = _build_session_params(
            mode='server_commit',
            response_format=AudioFormat.PCM_24000HZ_MONO_16BIT,
            custom_instructions=req.instructions,
        )

        tts.update_session(**session_params)
        tts.append_text(text)
        tts.finish()

        # 等待合成完成，最多 15 秒
        complete_event.wait(timeout=15)
        try:
            tts.close()
        except Exception:
            pass

    except Exception as e:
        logger.exception("TTS speak 失败")
        raise HTTPException(500, f"TTS 合成失败: {e}")

    if error_holder[0]:
        raise HTTPException(500, f"TTS 回调错误: {error_holder[0]}")

    if not audio_chunks:
        raise HTTPException(500, "TTS 未返回音频数据")

    combined = b"".join(audio_chunks)
    return {
        "audio_b64": base64.b64encode(combined).decode(),
        "format": "pcm_24000hz_mono_16bit",
        "sample_rate": 24000,
    }


@router.websocket("/stream")
async def tts_stream(ws: WebSocket, token: Optional[str] = Query(None)):
    await ws.accept()

    if not token:
        await ws.send_json({"type": "error", "code": "no_token", "message": "缺少认证 token"})
        await ws.close()
        return

    try:
        payload = decode_jwt_token(token)
    except ValueError as e:
        await ws.send_json({"type": "error", "code": "bad_token", "message": str(e)})
        await ws.close()
        return

    user = find_one("users.json", "username", payload.get("sub"))
    if not user:
        await ws.send_json({"type": "error", "code": "no_user", "message": "用户不存在"})
        await ws.close()
        return

    api_key = llm_module._get_api_key(None)
    if not api_key:
        await ws.send_json({"type": "error", "code": "no_api_key", "message": "TTS 服务未配置 API Key"})
        await ws.close()
        return

    loop = asyncio.get_running_loop()
    tts_lock = threading.Lock()
    state_lock = threading.Lock()
    active_request_id = {"value": None}
    session_instructions = {"value": None}
    tts_conn = None

    def set_active_request_id(value: Optional[str]):
        with state_lock:
            active_request_id["value"] = value

    def get_active_request_id() -> Optional[str]:
        with state_lock:
            return active_request_id["value"]

    try:
        import dashscope
        from dashscope.audio.qwen_tts_realtime import QwenTtsRealtime, QwenTtsRealtimeCallback, AudioFormat

        class _CB(QwenTtsRealtimeCallback):
            def on_open(self):
                pass

            def on_close(self, code, msg):
                logger.info("TTS stream closed: %s %s", code, msg)

            def on_event(self, response):
                try:
                    et = response.get("type", "")
                    request_id = get_active_request_id()
                    if et == "response.audio.delta":
                        b64 = response.get("delta", "")
                        if request_id and b64:
                            _send_threadsafe(loop, ws, {"type": "audio_chunk", "request_id": request_id, "data": b64})
                    elif et == "response.done":
                        if request_id:
                            _send_threadsafe(loop, ws, {"type": "chunk_done", "request_id": request_id})
                except Exception:
                    logger.exception("TTS stream callback 处理失败")

        def build_tts_connection(instructions: Optional[str] = None):
            dashscope.api_key = api_key
            conn = QwenTtsRealtime(model=TTS_MODEL, callback=_CB(), url=DASHSCOPE_WS_URL)
            conn.connect()
            session_params = _build_session_params(
                mode="commit",
                response_format=AudioFormat.PCM_24000HZ_MONO_16BIT,
                custom_instructions=instructions,
            )
            conn.update_session(**session_params)
            return conn

        tts_conn = await asyncio.to_thread(build_tts_connection, None)
        session_instructions["value"] = None
    except Exception as e:
        logger.exception("TTS stream 建连失败")
        await ws.send_json({"type": "error", "code": "tts_connect_failed", "message": str(e)})
        await ws.close()
        return

    async def call_tts(method_name: str, *args, **kwargs):
        with tts_lock:
            method = getattr(tts_conn, method_name)
            return await asyncio.to_thread(method, *args, **kwargs)

    async def rebuild_tts_connection(instructions: Optional[str]):
        nonlocal tts_conn
        with tts_lock:
            old_conn = tts_conn
            tts_conn = None
        if old_conn:
            try:
                await asyncio.to_thread(old_conn.close)
            except Exception:
                pass
        tts_conn = await asyncio.to_thread(build_tts_connection, instructions)
        session_instructions["value"] = instructions

    await ws.send_json({"type": "ready"})

    try:
        while True:
            msg = await ws.receive_json()
            mtype = msg.get("type")

            if mtype == "prewarm":
                await ws.send_json({"type": "ready"})
                continue

            if mtype == "start":
                request_id = (msg.get("request_id") or "").strip()
                instructions = (msg.get("instructions") or "").strip() or None
                if not request_id:
                    await ws.send_json({"type": "error", "code": "bad_request_id", "message": "缺少 request_id"})
                    continue

                set_active_request_id(None)
                try:
                    if tts_conn is None or session_instructions["value"] != instructions:
                        await rebuild_tts_connection(instructions)
                    else:
                        try:
                            await call_tts("cancel_response")
                        except Exception:
                            pass
                        try:
                            await call_tts("clear_appended_text")
                        except Exception:
                            pass
                except Exception as e:
                    logger.exception("TTS stream start 失败")
                    await ws.send_json({"type": "error", "code": "session_prepare_failed", "message": str(e)})
                    continue

                set_active_request_id(request_id)
                await ws.send_json({"type": "started", "request_id": request_id})
                continue

            if mtype == "append":
                text = (msg.get("text") or "").strip()
                if text:
                    try:
                        await call_tts("append_text", text)
                    except Exception as e:
                        await ws.send_json({"type": "error", "code": "append_failed", "message": str(e)})
                continue

            if mtype == "commit":
                try:
                    await call_tts("commit")
                except Exception as e:
                    await ws.send_json({"type": "error", "code": "commit_failed", "message": str(e)})
                continue

            if mtype == "interrupt":
                interrupted_request_id = get_active_request_id()
                set_active_request_id(None)
                try:
                    await call_tts("cancel_response")
                except Exception:
                    pass
                try:
                    await call_tts("clear_appended_text")
                except Exception:
                    pass
                await ws.send_json({"type": "interrupted", "request_id": interrupted_request_id})
                continue

            if mtype == "close":
                break

            await ws.send_json({"type": "error", "code": "unknown_type", "message": f"未知消息类型: {mtype}"})

    except WebSocketDisconnect:
        pass
    finally:
        set_active_request_id(None)
        if tts_conn:
            try:
                tts_conn.close()
            except Exception:
                pass
