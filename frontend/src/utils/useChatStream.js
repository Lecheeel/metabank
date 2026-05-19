import { useCallback, useEffect, useRef, useState } from 'react';
import { useTts } from './useTts';

const WS_URL = () => {
  const token = localStorage.getItem('token') || '';
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  return `${proto}://${location.host}/api/llm/stream?token=${encodeURIComponent(token)}`;
};

export function useChatStream({ mode = null, instructions = null, autoSpeakFirst = false, isActive = true, initialMessages = [] } = {}) {
  const initialMessagesRef = useRef(initialMessages);
  const [messages, setMessages] = useState(() => initialMessages);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('idle');
  const [toolCalls, setToolCalls] = useState([]);
  const [error, setError] = useState('');
  const wsRef = useRef(null);
  const currentTextBlockIndexRef = useRef(-1);
  const currentTextBlockContentRef = useRef('');
  const currentToolBlockIndexRef = useRef(-1);
  const currentTurnTextRef = useRef('');
  const welcomeSpokenRef = useRef('');
  const routeActiveRef = useRef(isActive);
  const turnIdRef = useRef(0);
  const activeTurnIdRef = useRef(null);
  const { speak, stop, speaking } = useTts(instructions || undefined);

  const ensureAssistantTextBlock = useCallback((draftMessages) => {
    const idx = currentTextBlockIndexRef.current;
    if (idx >= 0 && draftMessages[idx]?.role === 'ai' && (draftMessages[idx].kind || 'text') === 'text') {
      return idx;
    }
    draftMessages.push({ role: 'ai', kind: 'text', content: '', turnId: activeTurnIdRef.current });
    const nextIdx = draftMessages.length - 1;
    currentTextBlockIndexRef.current = nextIdx;
    currentTextBlockContentRef.current = '';
    currentToolBlockIndexRef.current = -1;
    return nextIdx;
  }, []);

  const appendToolResultToBlock = useCallback((toolBlock, toolCall) => {
    const pending = [...(toolBlock.pending_tool_calls || [])];
    const resultName = toolCall?.name;
    let removed = false;
    const nextPending = pending.filter((item) => {
      if (!removed && item?.function?.name === resultName) {
        removed = true;
        return false;
      }
      return true;
    });
    return {
      ...toolBlock,
      tool_calls: [...(toolBlock.tool_calls || []), toolCall],
      pending_tool_calls: removed ? nextPending : pending,
    };
  }, []);

  const closeSocket = useCallback(() => {
    const ws = wsRef.current;
    wsRef.current = null;
    if (!ws) return;
    if (ws.readyState === WebSocket.CONNECTING) return;
    try {
      ws.close();
    } catch {
      // Ignore close failures during teardown.
    }
  }, []);

  const interrupt = useCallback(() => {
    const turn_id = activeTurnIdRef.current;
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && turn_id) {
      try { wsRef.current.send(JSON.stringify({ type: 'interrupt', turn_id })); } catch {
        // Socket may already be closing.
      }
    }
    activeTurnIdRef.current = null;
    stop();
    setLoading(false);
    setStatus(routeActiveRef.current ? 'ready' : 'idle');
  }, [stop]);

  useEffect(() => {
    routeActiveRef.current = isActive;
    if (!isActive) {
      const disconnectTimer = window.setTimeout(() => {
        interrupt();
        closeSocket();
      }, 0);
      return () => window.clearTimeout(disconnectTimer);
    }
  }, [closeSocket, interrupt, isActive]);

  useEffect(() => {
    if (!isActive) return;

    let cancelled = false;
    let ws = null;
    const connectTimer = window.setTimeout(() => {
      if (cancelled) return;
      setStatus('connecting');
      ws = new WebSocket(WS_URL());
      wsRef.current = ws;

      ws.onopen = () => {
        if (cancelled || !routeActiveRef.current || wsRef.current !== ws) {
          try { ws.close(); } catch {
            // Ignore stale socket close failures.
          }
          return;
        }
        ws.send(JSON.stringify({ type: 'set_mode', mode }));
        setStatus('ready');
        setError('');
      };

      ws.onmessage = (e) => {
        if (cancelled || !routeActiveRef.current || wsRef.current !== ws) return;
        let msg;
        try { msg = JSON.parse(e.data); } catch { return; }
        if (msg.turn_id && activeTurnIdRef.current && msg.turn_id !== activeTurnIdRef.current) return;

        if (msg.type === 'ready') {
          setStatus('ready');
        } else if (msg.type === 'delta') {
          currentTextBlockContentRef.current += msg.content || '';
          currentTurnTextRef.current += msg.content || '';
          setMessages(prev => {
            const next = [...prev];
            const idx = ensureAssistantTextBlock(next);
            next[idx] = { ...next[idx], content: currentTextBlockContentRef.current };
            return next;
          });
        } else if (msg.type === 'tool_calls') {
          const calls = msg.tool_calls || [];
          setToolCalls(calls);
          setMessages(prev => {
            const next = [...prev];
            const textIdx = currentTextBlockIndexRef.current;
            if (
              textIdx >= 0 &&
              next[textIdx]?.role === 'ai' &&
              (next[textIdx].kind || 'text') === 'text' &&
              !((next[textIdx].content || '').trim())
            ) {
              next.splice(textIdx, 1);
              currentTextBlockIndexRef.current = -1;
              currentTextBlockContentRef.current = '';
            }
            next.push({
              role: 'ai',
              kind: 'tool',
              tool_calls: [],
              pending_tool_calls: calls,
              turnId: activeTurnIdRef.current,
            });
            currentToolBlockIndexRef.current = next.length - 1;
            currentTextBlockIndexRef.current = -1;
            currentTextBlockContentRef.current = '';
            return next;
          });
        } else if (msg.type === 'tool_result') {
          setMessages(prev => {
            const next = [...prev];
            const idx = currentToolBlockIndexRef.current;
            if (idx >= 0 && next[idx]?.role === 'ai' && next[idx].kind === 'tool') {
              next[idx] = appendToolResultToBlock(next[idx], msg.tool_call);
            } else {
              next.push({
                role: 'ai',
                kind: 'tool',
                tool_calls: [msg.tool_call],
                pending_tool_calls: [],
                turnId: activeTurnIdRef.current,
              });
              currentToolBlockIndexRef.current = next.length - 1;
            }
            return next;
          });
        } else if (msg.type === 'done') {
          const turnId = activeTurnIdRef.current || msg.turn_id || null;
          const finalText = (msg.content || '').trim();
          if (finalText) {
            if (!currentTurnTextRef.current) {
              currentTurnTextRef.current = finalText;
            }
            setMessages(prev => {
              const next = [...prev];
              const idx = currentTextBlockIndexRef.current;
              if (
                idx >= 0 &&
                next[idx]?.role === 'ai' &&
                (next[idx].kind || 'text') === 'text'
              ) {
                next[idx] = { ...next[idx], content: finalText, turnId: next[idx].turnId || turnId };
              } else {
                next.push({
                  role: 'ai',
                  kind: 'text',
                  content: finalText,
                  turnId,
                });
                currentTextBlockIndexRef.current = next.length - 1;
              }
              return next;
            });
            currentTextBlockContentRef.current = finalText;
          }
          setLoading(false);
          setStatus('ready');
          if (!msg.turn_id || msg.turn_id === activeTurnIdRef.current) {
            activeTurnIdRef.current = null;
          }
          const replyText = currentTurnTextRef.current || finalText || '';
          if (autoSpeakFirst && routeActiveRef.current && replyText.trim()) {
            void speak(replyText);
          }
        } else if (msg.type === 'interrupted') {
          setLoading(false);
          setStatus('ready');
          if (!msg.turn_id || msg.turn_id === activeTurnIdRef.current) {
            activeTurnIdRef.current = null;
          }
        } else if (msg.type === 'error') {
          setError(msg.message || '发生错误');
          setStatus('ready');
          setLoading(false);
        }
      };

      ws.onerror = () => {
        if (cancelled || !routeActiveRef.current || wsRef.current !== ws) return;
        setError('流式对话连接失败');
        setStatus('error');
        setLoading(false);
      };

      ws.onclose = () => {
        if (wsRef.current === ws) {
          wsRef.current = null;
        }
        if (!cancelled && routeActiveRef.current) {
          setStatus('idle');
          setLoading(false);
        }
      };
    }, 0);

    return () => {
      cancelled = true;
      clearTimeout(connectTimer);
      closeSocket();
    };
  }, [appendToolResultToBlock, autoSpeakFirst, closeSocket, ensureAssistantTextBlock, isActive, mode, speak]);

  useEffect(() => {
    if (!isActive || !autoSpeakFirst) return;
    const firstAi = messages.find(m => m.role === 'ai');
    const welcomeText = (firstAi?.content || '').trim();
    if (welcomeText && welcomeSpokenRef.current !== welcomeText) {
      welcomeSpokenRef.current = welcomeText;
      void speak(welcomeText);
    }
  }, [autoSpeakFirst, isActive, messages, speak]);

  useEffect(() => () => {
    interrupt();
    closeSocket();
  }, [closeSocket, interrupt]);

  const send = useCallback((content) => {
    const text = (content || '').trim();
    if (!text || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    const previousTurnId = activeTurnIdRef.current;
    if (previousTurnId) {
      try { wsRef.current.send(JSON.stringify({ type: 'interrupt', turn_id: previousTurnId })); } catch {
        // Best-effort interruption before starting a new turn.
      }
      activeTurnIdRef.current = null;
    }
    const turn_id = `${Date.now()}-${++turnIdRef.current}`;
    stop();
    setLoading(true);
    setError('');
    setMessages(prev => {
      const next = [...prev, { role: 'user', content: text, turnId: turn_id }];
      currentTextBlockIndexRef.current = next.length;
      currentTextBlockContentRef.current = '';
      currentToolBlockIndexRef.current = -1;
      currentTurnTextRef.current = '';
      return [...next, { role: 'ai', kind: 'text', content: '', turnId: turn_id }];
    });
    activeTurnIdRef.current = turn_id;
    wsRef.current.send(JSON.stringify({ type: 'message', content: text, mode, turn_id }));
  }, [mode, stop]);

  const reset = useCallback(() => {
    stop();
    setMessages(initialMessagesRef.current);
    setToolCalls([]);
    currentTextBlockIndexRef.current = -1;
    currentTextBlockContentRef.current = '';
    currentToolBlockIndexRef.current = -1;
    currentTurnTextRef.current = '';
    welcomeSpokenRef.current = '';
    activeTurnIdRef.current = null;
  }, [stop]);

  return {
    messages,
    setMessages,
    loading,
    status,
    toolCalls,
    error,
    speaking,
    speak,
    send,
    stop: interrupt,
    reset,
    setError,
  };
}
