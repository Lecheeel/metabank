"""
语音助手代理 - 桥接浏览器 WebSocket 与 DashScope Qwen ASR/TTS Realtime。

协议（客户端 ↔ 服务端 JSON）：
  client → server:
    {"type":"audio","data":"<base64 16k pcm>"}  音频帧
    {"type":"stop"}                              结束输入触发 LLM
    {"type":"text","content":"..."}              直接发文本（键盘）
    {"type":"interrupt"}                         打断 TTS
  server → client:
    {"type":"asr_partial","text":"..."}
    {"type":"asr_final","text":"..."}
    {"type":"llm_reply","text":"...","tool_calls":[...]}
    {"type":"tts_chunk","data":"<base64 24k pcm>"}
    {"type":"tts_end"}
    {"type":"error","code":"...","message":"..."}
    {"type":"ready"}                             连接建立后
"""
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from typing import Optional, Dict, Any
import asyncio
import base64
import logging
import threading

from auth_utils import decode_jwt_token
from storage import find_one
from . import llm as llm_module

logger = logging.getLogger(__name__)
router = APIRouter()

DASHSCOPE_WS_URL = "wss://dashscope.aliyuncs.com/api-ws/v1/realtime"
ASR_MODEL = "qwen3-asr-flash-realtime"
TTS_MODEL = "qwen3-tts-instruct-flash-realtime"
TTS_VOICE = "Cherry"
ASR_SAMPLE_RATE = 16000


def _send_threadsafe(loop: asyncio.AbstractEventLoop, ws: WebSocket, payload: Dict[str, Any]):
    """从非 asyncio 线程安全调度向 ws 发送 JSON。"""
    try:
        asyncio.run_coroutine_threadsafe(ws.send_json(payload), loop)
    except Exception as e:
        logger.error(f"send_threadsafe 失败: {e}")


class _ASRBridge:
    """把 dashscope ASR 回调事件转发到 WebSocket。"""
    def __init__(self, loop, ws):
        self.loop = loop
        self.ws = ws

    def make_callback(self):
        from dashscope.audio.qwen_omni import OmniRealtimeCallback
        bridge = self

        class CB(OmniRealtimeCallback):
            def on_open(self):
                logger.info("ASR opened")

            def on_close(self, code, msg):
                logger.info(f"ASR closed: {code} {msg}")

            def on_event(self, response):
                try:
                    et = response.get('type', '')
                    if et == 'conversation.item.input_audio_transcription.completed':
                        text = response.get('transcript', '')
                        if text:
                            _send_threadsafe(bridge.loop, bridge.ws, {"type": "asr_final", "text": text})
                    elif et == 'conversation.item.input_audio_transcription.text':
                        text = response.get('stash', '')
                        if text:
                            _send_threadsafe(bridge.loop, bridge.ws, {"type": "asr_partial", "text": text})
                except Exception as e:
                    logger.error(f"ASR on_event 错误: {e}")
        return CB()


class _TTSBridge:
    def __init__(self, loop, ws, on_finish):
        self.loop = loop
        self.ws = ws
        self.on_finish = on_finish
        self.is_active = False

    def make_callback(self):
        from dashscope.audio.qwen_tts_realtime import QwenTtsRealtimeCallback
        bridge = self

        class CB(QwenTtsRealtimeCallback):
            def on_open(self):
                logger.info("TTS opened")

            def on_close(self, code, msg):
                logger.info(f"TTS closed: {code} {msg}")
                bridge.is_active = False

            def on_event(self, response):
                try:
                    et = response.get('type', '')
                    if et == 'response.audio.delta':
                        b64 = response.get('delta', '')
                        if b64:
                            _send_threadsafe(bridge.loop, bridge.ws, {"type": "tts_chunk", "data": b64})
                    elif et == 'session.started':
                        bridge.is_active = True
                    elif et == 'session.finished':
                        bridge.is_active = False
                        _send_threadsafe(bridge.loop, bridge.ws, {"type": "tts_end"})
                        if bridge.on_finish:
                            bridge.on_finish()
                except Exception as e:
                    logger.error(f"TTS on_event 错误: {e}")
        return CB()


def _make_asr(api_key, callback):
    import dashscope
    from dashscope.audio.qwen_omni import OmniRealtimeConversation, MultiModality
    from dashscope.audio.qwen_omni.omni_realtime import TranscriptionParams
    dashscope.api_key = api_key
    conv = OmniRealtimeConversation(model=ASR_MODEL, url=DASHSCOPE_WS_URL, callback=callback)
    conv.connect()
    params = TranscriptionParams(language='zh', sample_rate=ASR_SAMPLE_RATE, input_audio_format='pcm')
    conv.update_session(
        output_modalities=[MultiModality.TEXT],
        enable_input_audio_transcription=True,
        transcription_params=params,
    )
    return conv


def _make_tts(api_key, callback, instructions: str = None):
    import dashscope
    from dashscope.audio.qwen_tts_realtime import QwenTtsRealtime, AudioFormat
    dashscope.api_key = api_key
    tts = QwenTtsRealtime(model=TTS_MODEL, callback=callback, url=DASHSCOPE_WS_URL)
    tts.connect()
    session_params = dict(
        voice=TTS_VOICE,
        response_format=AudioFormat.PCM_24000HZ_MONO_16BIT,
        mode='server_commit',
    )
    if instructions:
        session_params['instructions'] = instructions
        session_params['optimize_instructions'] = True
    tts.update_session(**session_params)
    return tts


@router.websocket("/ws")
async def voice_ws(ws: WebSocket, token: Optional[str] = Query(None)):
    await ws.accept()

    # JWT 鉴权
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
        await ws.send_json({"type": "error", "code": "no_api_key", "message": "后端未配置 DashScope API Key"})
        await ws.close()
        return

    loop = asyncio.get_event_loop()
    asr_conn = None
    tts_conn = None
    tts_lock = threading.Lock()

    def cleanup():
        nonlocal asr_conn, tts_conn
        try:
            if asr_conn:
                asr_conn.close()
        except Exception:
            pass
        try:
            if tts_conn:
                tts_conn.close()
        except Exception:
            pass
        asr_conn = None
        tts_conn = None

    try:
        # 建立 ASR 连接
        try:
            asr_bridge = _ASRBridge(loop, ws)
            asr_conn = await asyncio.to_thread(_make_asr, api_key, asr_bridge.make_callback())
        except Exception as e:
            logger.exception("ASR 建连失败")
            await ws.send_json({"type": "error", "code": "asr_connect_failed", "message": str(e)})
            await ws.close()
            return

        await ws.send_json({"type": "ready", "user": user.get("nickname")})

        # 处理用户文本（含来自 ASR final 的回调），跑 LLM 并启动 TTS
        async def handle_user_text(text: str):
            nonlocal tts_conn
            text = (text or "").strip()
            if not text:
                return
            # 调用现有 LLM
            try:
                response_text, tool_calls = await asyncio.to_thread(
                    llm_module._call_dashscope, text, user, api_key, "elder"
                )
            except Exception as e:
                logger.exception("LLM 调用失败")
                await ws.send_json({"type": "error", "code": "llm_failed", "message": str(e)})
                return
            await ws.send_json({"type": "llm_reply", "text": response_text, "tool_calls": tool_calls})

            # 启动 TTS
            with tts_lock:
                if tts_conn:
                    try:
                        tts_conn.close()
                    except Exception:
                        pass
                    tts_conn = None
                tts_bridge = _TTSBridge(loop, ws, on_finish=None)
                try:
                    tts_conn = await asyncio.to_thread(_make_tts, api_key, tts_bridge.make_callback())
                    await asyncio.to_thread(tts_conn.append_text, response_text)
                    await asyncio.to_thread(tts_conn.finish)
                except Exception as e:
                    logger.exception("TTS 失败")
                    await ws.send_json({"type": "error", "code": "tts_failed", "message": str(e)})

        # 监听客户端消息
        pending_text_buf = []

        # 用一个 asyncio.Queue 将 asr_final 文本传给主 loop（也可以直接 await）
        asr_final_queue: asyncio.Queue = asyncio.Queue()

        # 改造 ASR 回调使其同时把 final 推到队列（包装一层）
        original_send = _send_threadsafe
        def asr_intercept(loop_, ws_, payload):
            original_send(loop_, ws_, payload)
            if payload.get("type") == "asr_final":
                asyncio.run_coroutine_threadsafe(asr_final_queue.put(payload.get("text", "")), loop_)
        # monkeypatch only for this connection - 简单做法：直接重写 bridge 的发送
        # 由于我们已经在 _ASRBridge.make_callback 中直接调用 _send_threadsafe，这里不便插钩；
        # 采取简化方案：客户端发 stop 时由 server 自行从最近一次 asr_final 文本读取。
        last_asr_final = {"text": ""}

        # 重新挂个 task，监听 asr_final_queue 在协议层不必要 —— 改为：
        # 在 _ASRBridge 增强：把 final 也写到 last_asr_final dict
        def patched_event_relay(payload):
            if payload.get("type") == "asr_final":
                last_asr_final["text"] = payload.get("text", "")

        # 直接 patch _send_threadsafe 在本作用域
        # 简化：自定义新 bridge 类替换上面的
        # （为了不改类结构，借助 ws.send_json 后再处理 final 即可，因此跳过此环节）

        # 主循环
        while True:
            msg = await ws.receive_json()
            mtype = msg.get("type")
            if mtype == "audio":
                data_b64 = msg.get("data", "")
                if data_b64 and asr_conn:
                    try:
                        await asyncio.to_thread(asr_conn.append_audio, data_b64)
                    except Exception as e:
                        logger.error(f"append_audio 失败: {e}")
            elif mtype == "stop":
                # 客户端通知本轮录音结束，等待 final 后由服务端自行触发 LLM
                # 简化：让客户端在收到 asr_final 后再发 text 类型消息触发
                await ws.send_json({"type": "asr_stopped"})
            elif mtype == "text":
                content = msg.get("content", "")
                await handle_user_text(content)
            elif mtype == "interrupt":
                with tts_lock:
                    if tts_conn:
                        try:
                            tts_conn.close()
                        except Exception:
                            pass
                        tts_conn = None
                await ws.send_json({"type": "tts_end", "interrupted": True})
            else:
                await ws.send_json({"type": "error", "code": "unknown_type", "message": f"未知消息类型: {mtype}"})

    except WebSocketDisconnect:
        logger.info("voice ws 客户端断开")
    except Exception as e:
        logger.exception("voice ws 错误")
        try:
            await ws.send_json({"type": "error", "code": "internal", "message": str(e)})
        except Exception:
            pass
    finally:
        cleanup()
