import { useCallback, useEffect, useRef, useState } from 'react';

const WS_URL = () => {
  const token = localStorage.getItem('token') || '';
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  return `${proto}://${location.host}/api/tts/stream?token=${encodeURIComponent(token)}`;
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

let sharedWs = null;
let sharedReadyPromise = null;
let sharedCtx = null;
let queue = [];
let playing = false;
let source = null;
let currentRequestId = null;
let currentInstructions = null;
let currentCommitRequested = false;
let currentCommitAcknowledged = false;
const listeners = new Set();

const MAX_APPEND_CHARS = 260;

const notify = (patch) => {
  listeners.forEach((listener) => {
    try {
      listener(patch);
    } catch {
      // Ignore listener failures so one consumer cannot break others.
    }
  });
};

const ensureAudioContext = async () => {
  const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextCtor) throw new Error('当前浏览器不支持 AudioContext');
  if (!sharedCtx || sharedCtx.state === 'closed') {
    sharedCtx = new AudioContextCtor({ sampleRate: 24000 });
  }
  if (sharedCtx.state === 'suspended') {
    try { await sharedCtx.resume(); } catch {
      // Some browsers require a fresh user gesture before audio can resume.
    }
  }
  return sharedCtx;
};

const playNext = async () => {
  if (playing || queue.length === 0) {
    if (!playing && queue.length === 0 && currentCommitRequested && currentCommitAcknowledged && currentRequestId) {
      notify({ speaking: false });
      currentRequestId = null;
      currentInstructions = null;
      currentCommitRequested = false;
      currentCommitAcknowledged = false;
    }
    return;
  }

  const ctx = await ensureAudioContext();
  const f32 = queue.shift();
  const buf = ctx.createBuffer(1, f32.length, 24000);
  buf.copyToChannel(f32, 0);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.connect(ctx.destination);
  source = src;
  playing = true;
  notify({ speaking: true });
  src.onended = () => {
    if (source === src) source = null;
    playing = false;
    void playNext();
  };
  src.start();
};

const resetPlayback = () => {
  queue = [];
  playing = false;
  currentCommitRequested = false;
  currentCommitAcknowledged = false;
  if (source) {
    try { source.stop(); } catch {
      // Source may already be stopped.
    }
    source = null;
  }
  notify({ speaking: false });
};

const attachMessageHandlers = (ws) => {
  ws.onmessage = (e) => {
    let msg;
    try { msg = JSON.parse(e.data); } catch { return; }
    if (msg.type === 'ready') {
      notify({ ready: true });
    } else if (msg.type === 'audio_chunk') {
      if (msg.request_id && msg.request_id === currentRequestId) {
        queue.push(base64ToFloat32(msg.data));
        void playNext();
      }
    } else if (msg.type === 'chunk_done') {
      if (msg.request_id && msg.request_id === currentRequestId) {
        currentCommitAcknowledged = true;
        void playNext();
      }
    } else if (msg.type === 'interrupted') {
      const interruptedRequestId = msg.request_id || null;
      if (!currentRequestId || (interruptedRequestId && interruptedRequestId === currentRequestId)) {
        resetPlayback();
        currentRequestId = null;
        currentInstructions = null;
      }
    } else if (msg.type === 'error') {
      notify({ error: msg.message || 'TTS 错误', speaking: false });
    }
  };

  ws.onclose = () => {
    sharedWs = null;
    sharedReadyPromise = null;
    notify({ ready: false, speaking: false });
  };

  ws.onerror = () => {
    notify({ error: 'TTS 连接失败', speaking: false });
  };
};

const ensureWs = () => {
  if (sharedWs && sharedWs.readyState === WebSocket.OPEN) {
    return Promise.resolve(sharedWs);
  }
  if (sharedReadyPromise) {
    return sharedReadyPromise;
  }

  sharedReadyPromise = new Promise((resolve, reject) => {
    const ws = new WebSocket(WS_URL());
    sharedWs = ws;

    ws.onopen = () => {
      attachMessageHandlers(ws);
      try {
        ws.send(JSON.stringify({ type: 'prewarm' }));
      } catch {
        // Ignore prewarm races; regular requests will reconnect if needed.
      }
    };

    const readyHandler = (patch) => {
      if (patch.ready) {
        listeners.delete(readyHandler);
        resolve(ws);
      } else if (patch.error) {
        listeners.delete(readyHandler);
        reject(new Error(patch.error));
      }
    };
    listeners.add(readyHandler);

    ws.onclose = () => {
      listeners.delete(readyHandler);
      sharedWs = null;
      sharedReadyPromise = null;
      reject(new Error('TTS 连接已关闭'));
      notify({ ready: false, speaking: false });
    };

    ws.onerror = () => {
      listeners.delete(readyHandler);
      reject(new Error('TTS 连接失败'));
      notify({ error: 'TTS 连接失败', speaking: false });
    };
  }).finally(() => {
    if (sharedWs?.readyState !== WebSocket.OPEN) {
      sharedReadyPromise = null;
    }
  });

  return sharedReadyPromise;
};

const sanitizeText = (text) => {
  return (text || '')
    .replace(/\p{Extended_Pictographic}/gu, ' ')
    .replace(/[\uFE0F\u200D]/g, '')
    .replace(/#{1,6}\s/g, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/`{1,3}[^`]*`{1,3}/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/>\s/g, '')
    .replace(/[-*+]\s/g, '')
    .replace(/\n{2,}/g, '。')
    .replace(/\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

const splitSpeakableText = (text) => {
  const plain = sanitizeText(text);
  if (!plain) return [];

  const chunks = [];
  let rest = plain;

  while (rest.length > MAX_APPEND_CHARS) {
    const slice = rest.slice(0, MAX_APPEND_CHARS);
    const boundary =
      Math.max(
        slice.lastIndexOf('。'),
        slice.lastIndexOf('！'),
        slice.lastIndexOf('？'),
        slice.lastIndexOf('；'),
        slice.lastIndexOf('，'),
        slice.lastIndexOf('：'),
        slice.lastIndexOf('. '),
        slice.lastIndexOf('! '),
        slice.lastIndexOf('? '),
        slice.lastIndexOf(', '),
        slice.lastIndexOf('; '),
      );
    const cutIndex = boundary >= Math.floor(MAX_APPEND_CHARS * 0.5) ? boundary + 1 : MAX_APPEND_CHARS;
    const chunk = rest.slice(0, cutIndex).trim();
    if (chunk) chunks.push(chunk);
    rest = rest.slice(cutIndex).trim();
  }

  if (rest) chunks.push(rest);
  return chunks;
};

export function useTts(instructions) {
  const [speaking, setSpeaking] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const mountedRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    const listener = (patch) => {
      if (!mountedRef.current) return;
      if (typeof patch.speaking === 'boolean') setSpeaking(patch.speaking);
      if (typeof patch.ready === 'boolean') setReady(patch.ready);
      if (patch.error) setError(patch.error);
    };
    listeners.add(listener);
    void ensureWs().catch((e) => {
      if (mountedRef.current) setError(e.message || 'TTS 初始化失败');
    });
    return () => {
      mountedRef.current = false;
      listeners.delete(listener);
    };
  }, []);

  const stop = useCallback(async () => {
    resetPlayback();
    currentRequestId = null;
    currentInstructions = null;
    if (sharedWs && sharedWs.readyState === WebSocket.OPEN) {
      try {
        sharedWs.send(JSON.stringify({ type: 'interrupt' }));
      } catch {
        // Ignore best-effort interruption failures.
      }
    }
  }, []);

  const beginStream = useCallback(async (customInstructions = instructions) => {
    const ws = await ensureWs();
    const requestId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    await stop();
    currentRequestId = requestId;
    currentInstructions = customInstructions || null;
    currentCommitRequested = false;
    currentCommitAcknowledged = false;
    setError('');
    try {
      ws.send(JSON.stringify({
        type: 'start',
        request_id: requestId,
        instructions: currentInstructions,
      }));
      notify({ speaking: true });
      return requestId;
    } catch (e) {
      currentRequestId = null;
      notify({ speaking: false });
      throw e;
    }
  }, [instructions, stop]);

  const appendStreamText = useCallback(async (text, requestId = currentRequestId) => {
    const chunks = splitSpeakableText(text);
    if (chunks.length === 0 || !requestId) return;
    const ws = await ensureWs();
    if (requestId !== currentRequestId) return;
    chunks.forEach((chunk) => {
      ws.send(JSON.stringify({ type: 'append', request_id: requestId, text: chunk }));
    });
  }, []);

  const commitStream = useCallback(async (requestId = currentRequestId) => {
    if (!requestId || requestId !== currentRequestId) return;
    const ws = await ensureWs();
    currentCommitRequested = true;
    ws.send(JSON.stringify({ type: 'commit', request_id: requestId }));
  }, []);

  const speak = useCallback(async (text) => {
    if (splitSpeakableText(text).length === 0) return;
    const requestId = await beginStream(instructions);
    await appendStreamText(text, requestId);
    await commitStream(requestId);
  }, [appendStreamText, beginStream, commitStream, instructions]);

  return {
    speak,
    stop,
    speaking,
    ready,
    error,
    beginStream,
    appendStreamText,
    commitStream,
  };
}
