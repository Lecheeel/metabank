import { useState, useEffect, useRef, useCallback } from 'react';
import { Mic, MicOff, Square, Volume2, MessageSquare, X } from 'lucide-react';

const WS_URL = () => {
  const token = localStorage.getItem('token') || '';
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  return `${proto}://${location.host}/api/voice/ws?token=${encodeURIComponent(token)}`;
};

const int16ToBase64 = (buf) => {
  const bytes = new Uint8Array(buf.buffer);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
};

const base64ToFloat32 = (b64) => {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const int16 = new Int16Array(bytes.buffer);
  const f32 = new Float32Array(int16.length);
  for (let i = 0; i < int16.length; i++) f32[i] = int16[i] / 32768;
  return f32;
};

export default function VoiceBar() {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState('idle'); // idle | connecting | ready | recording | thinking | speaking | error | text-fallback
  const [partial, setPartial] = useState('');
  const [final, setFinal] = useState('');
  const [reply, setReply] = useState('');
  const [toolCalls, setToolCalls] = useState([]);
  const [textInput, setTextInput] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const wsRef = useRef(null);
  const audioCtxRef = useRef(null);
  const workletNodeRef = useRef(null);
  const streamRef = useRef(null);
  const ttsQueueRef = useRef([]);
  const ttsPlayingRef = useRef(false);
  const ttsSourceRef = useRef(null);

  // ── TTS 播放队列 ──────────────────────────────────────────────
  const playNextTts = useCallback(() => {
    if (ttsPlayingRef.current || ttsQueueRef.current.length === 0) return;
    const f32 = ttsQueueRef.current.shift();
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    const buf = ctx.createBuffer(1, f32.length, 24000);
    buf.copyToChannel(f32, 0);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(ctx.destination);
    ttsSourceRef.current = src;
    ttsPlayingRef.current = true;
    src.onended = () => {
      ttsPlayingRef.current = false;
      ttsSourceRef.current = null;
      playNextTts();
    };
    src.start();
  }, []);

  const stopTts = useCallback(() => {
    ttsQueueRef.current = [];
    ttsPlayingRef.current = false;
    if (ttsSourceRef.current) {
      try { ttsSourceRef.current.stop(); } catch {}
      ttsSourceRef.current = null;
    }
  }, []);

  // ── 停止录音 ──────────────────────────────────────────────────
  const stopRecording = useCallback(() => {
    if (workletNodeRef.current) {
      workletNodeRef.current.disconnect();
      workletNodeRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'stop' }));
    }
    setStatus('thinking');
  }, []);

  // ── 开始录音 ──────────────────────────────────────────────────
  const startRecording = useCallback(async () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { sampleRate: 16000, channelCount: 1, echoCancellation: true, noiseSuppression: true },
      });
      streamRef.current = stream;

      const ctx = new AudioContext({ sampleRate: 16000 });
      audioCtxRef.current = ctx;
      await ctx.audioWorklet.addModule('/pcm-recorder-worklet.js');
      const src = ctx.createMediaStreamSource(stream);
      const node = new AudioWorkletNode(ctx, 'pcm-recorder');
      node.port.onmessage = (e) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: 'audio', data: int16ToBase64(e.data) }));
        }
      };
      src.connect(node);
      workletNodeRef.current = node;
      wsRef.current.send(JSON.stringify({ type: 'start' }));
      setStatus('recording');
      setPartial('');
      setFinal('');
    } catch (err) {
      setErrorMsg('无法访问麦克风：' + err.message);
      setStatus('text-fallback');
    }
  }, []);

  // ── 建立 WebSocket ────────────────────────────────────────────
  const connect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setStatus('connecting');
    setErrorMsg('');
    const ws = new WebSocket(WS_URL());
    wsRef.current = ws;

    ws.onopen = () => {};
    ws.onmessage = (e) => {
      let msg;
      try { msg = JSON.parse(e.data); } catch { return; }
      const t = msg.type;
      if (t === 'ready') {
        setStatus('ready');
      } else if (t === 'asr_partial') {
        setPartial(msg.text || '');
      } else if (t === 'asr_final') {
        setFinal(msg.text || '');
        setPartial('');
        // 收到 final 后自动发 text 触发 LLM
        ws.send(JSON.stringify({ type: 'text', content: msg.text }));
      } else if (t === 'llm_reply') {
        setReply(msg.text || '');
        setToolCalls(msg.tool_calls || []);
        setStatus('speaking');
        ttsQueueRef.current = [];
      } else if (t === 'tts_chunk') {
        const f32 = base64ToFloat32(msg.data);
        ttsQueueRef.current.push(f32);
        playNextTts();
      } else if (t === 'tts_end') {
        // 等队列播完后回到 ready
        const check = setInterval(() => {
          if (!ttsPlayingRef.current && ttsQueueRef.current.length === 0) {
            clearInterval(check);
            setStatus('ready');
          }
        }, 200);
      } else if (t === 'error') {
        const code = msg.code || '';
        if (code === 'no_api_key' || code === 'asr_connect_failed') {
          setStatus('text-fallback');
          setErrorMsg(msg.message || '语音服务不可用，已切换为文本模式');
        } else {
          setErrorMsg(msg.message || '发生错误');
          setStatus('ready');
        }
      }
    };
    ws.onerror = () => {
      setStatus('text-fallback');
      setErrorMsg('语音服务连接失败，已切换为文本模式');
    };
    ws.onclose = () => {
      if (status !== 'text-fallback') setStatus('idle');
    };
  }, [playNextTts, status]);

  // ── 打开面板时建连 ────────────────────────────────────────────
  useEffect(() => {
    if (open) {
      connect();
    } else {
      stopRecording();
      stopTts();
      if (wsRef.current) { wsRef.current.close(); wsRef.current = null; }
      if (audioCtxRef.current) { audioCtxRef.current.close(); audioCtxRef.current = null; }
      setStatus('idle');
      setPartial(''); setFinal(''); setReply(''); setErrorMsg('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // ── 键盘快捷键 ────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e) => {
      if (!open) return;
      if (e.key === 'Escape') { setOpen(false); return; }
      if (e.code === 'Space' && e.target.tagName !== 'INPUT') {
        e.preventDefault();
        if (status === 'ready') startRecording();
        else if (status === 'recording') stopRecording();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, status, startRecording, stopRecording]);

  // ── 文本降级发送 ──────────────────────────────────────────────
  const sendText = () => {
    const t = textInput.trim();
    if (!t) return;
    setTextInput('');
    setFinal(t);
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'text', content: t }));
      setStatus('thinking');
    }
  };

  // ── 状态颜色 ──────────────────────────────────────────────────
  const statusColor = {
    idle: '#9ca3af', connecting: '#f59e0b', ready: '#16a34a',
    recording: '#ef4444', thinking: '#f97316', speaking: '#3b82f6',
    error: '#ef4444', 'text-fallback': '#f59e0b',
  }[status] || '#9ca3af';

  const statusLabel = {
    idle: '未连接', connecting: '连接中…', ready: '就绪（按住 Space 说话）',
    recording: '正在录音…', thinking: '思考中…', speaking: '正在播报…',
    error: '出错', 'text-fallback': '文本模式',
  }[status] || '';

  return (
    <>
      {/* 浮动触发按钮 */}
      <button
        onClick={() => setOpen(o => !o)}
        aria-label="语音助手"
        style={{
          position: 'fixed', bottom: '2rem', right: '2rem', zIndex: 51,
          width: '3.5rem', height: '3.5rem', borderRadius: '50%',
          background: open ? '#ef4444' : 'linear-gradient(135deg,#f97316,#ea580c)',
          color: '#fff', border: 'none', cursor: 'pointer',
          boxShadow: '0 4px 16px rgba(249,115,22,0.45)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'all 0.2s',
        }}
      >
        {open ? <X size={22} /> : <Mic size={22} />}
      </button>

      {/* 展开面板 */}
      {open && (
        <div
          style={{
            position: 'fixed', bottom: '5.5rem', right: '2rem', zIndex: 50,
            width: 'min(22rem, calc(100vw - 2rem))',
            background: '#ffffff', borderRadius: '1.25rem',
            border: '1px solid #e5e7eb',
            boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
            padding: '1.25rem',
            display: 'flex', flexDirection: 'column', gap: '0.875rem',
          }}
        >
          {/* 标题栏 */}
          <div className="flex items-center justify-between">
            <span style={{ fontWeight: 700, fontSize: '1.0625rem', color: '#111827' }}>🎤 语音助手</span>
            <span style={{ fontSize: '0.8125rem', color: statusColor, fontWeight: 600 }}>
              ● {statusLabel}
            </span>
          </div>

          {/* 错误提示 */}
          {errorMsg && (
            <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: '0.75rem', padding: '0.625rem 0.875rem', fontSize: '0.9375rem', color: '#ea580c' }}>
              {errorMsg}
            </div>
          )}

          {/* 字幕区 */}
          {(partial || final) && (
            <div style={{ background: '#f9fafb', borderRadius: '0.75rem', padding: '0.75rem', fontSize: '1rem', color: '#374151', minHeight: '2.5rem' }}>
              {partial && <span style={{ color: '#9ca3af' }}>{partial}</span>}
              {final && !partial && <span style={{ color: '#111827', fontWeight: 500 }}>{final}</span>}
            </div>
          )}

          {/* AI 回复 */}
          {reply && (
            <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: '0.75rem', padding: '0.75rem', fontSize: '1rem', color: '#111827', lineHeight: 1.6 }}>
              <span style={{ fontSize: '0.8125rem', color: '#ea580c', fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>AI 回复</span>
              {reply}
            </div>
          )}

          {/* 录音控制 */}
          {status !== 'text-fallback' && (
            <div className="flex gap-2">
              {status === 'ready' && (
                <button
                  onClick={startRecording}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold"
                  style={{ background: 'linear-gradient(135deg,#f97316,#ea580c)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '1rem' }}
                >
                  <Mic size={18} /> 开始说话
                </button>
              )}
              {status === 'recording' && (
                <button
                  onClick={stopRecording}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold"
                  style={{ background: '#ef4444', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '1rem' }}
                >
                  <Square size={18} /> 停止录音
                </button>
              )}
              {status === 'speaking' && (
                <button
                  onClick={() => {
                    stopTts();
                    if (wsRef.current?.readyState === WebSocket.OPEN) {
                      wsRef.current.send(JSON.stringify({ type: 'interrupt' }));
                    }
                    setStatus('ready');
                  }}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold"
                  style={{ background: '#3b82f6', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '1rem' }}
                >
                  <MicOff size={18} /> 打断播报
                </button>
              )}
              {(status === 'connecting' || status === 'thinking') && (
                <div className="flex-1 flex items-center justify-center py-2.5" style={{ color: '#9ca3af', fontSize: '1rem' }}>
                  {status === 'connecting' ? '连接中…' : '思考中…'}
                </div>
              )}
            </div>
          )}

          {/* 文本输入（降级或补充） */}
          <div className="flex gap-2">
            <input
              type="text"
              className="input-field"
              placeholder={status === 'text-fallback' ? '语音不可用，请输入文字…' : '也可以直接输入文字…'}
              value={textInput}
              onChange={e => setTextInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') sendText(); }}
              style={{ fontSize: '0.9375rem', padding: '0.625rem 0.875rem' }}
            />
            <button
              onClick={sendText}
              disabled={!textInput.trim()}
              style={{
                padding: '0.625rem 1rem', borderRadius: '0.75rem',
                background: textInput.trim() ? 'linear-gradient(135deg,#f97316,#ea580c)' : '#e5e7eb',
                color: textInput.trim() ? '#fff' : '#9ca3af',
                border: 'none', cursor: textInput.trim() ? 'pointer' : 'default',
                fontSize: '0.9375rem',
              }}
            >
              <MessageSquare size={16} />
            </button>
          </div>

          <p style={{ fontSize: '0.8125rem', color: '#9ca3af', textAlign: 'center' }}>
            Space 按住说话 · Esc 关闭
          </p>
        </div>
      )}
    </>
  );
}
