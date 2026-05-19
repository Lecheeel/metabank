import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { useLocation } from 'react-router-dom';
import api from '../utils/api';
import { useChatStream } from '../utils/useChatStream';
import { Activity, AlertCircle, Bell, BookOpen, Bot, CheckCircle, HeartHandshake, Send, ShieldCheck, Square, User, Volume2, VolumeX, Wallet } from 'lucide-react';

const QUICK_ACTIONS = [
  { label: '查余额', message: '请帮我查询我的国脉币余额，并用简单的话告诉我。', icon: Wallet, accent: '#f97316' },
  { label: '看家人动态', message: '帮我看看最近老张头在干嘛，并简单说给我听。', icon: User, accent: '#14b8a6' },
  { label: '风险提醒', message: '请结合我最近的账户情况，告诉我今天最需要注意的风险。', icon: ShieldCheck, accent: '#ef4444' },
  { label: '慢慢讲给我听', message: '请用最简单的话，慢慢告诉我最近哪些理财方式更稳健。', icon: BookOpen, accent: '#8b5cf6' },
];

const ELDER_TTS_INSTRUCTIONS = '语调温和亲切，像一位耐心的家庭理财顾问在讲解，表达清楚自然。';
const ELDER_WELCOME_MESSAGES = [
  {
    role: 'ai',
    content: '您好，我是您的专属理财顾问。您不用着急，我会用简单、清楚、稳妥的话，慢慢陪您看懂账户情况和理财建议。',
    tool_calls: [],
  },
];

function ToolResultBlock({ result }) {
  if (!result) return null;
  const ok = result.success;
  return (
    <div className="rounded-2xl overflow-hidden" style={{ border: `2px solid ${ok ? '#fcd34d' : '#fca5a5'}`, background: ok ? 'linear-gradient(135deg, #fffbeb 0%, #fff7ed 100%)' : 'linear-gradient(135deg, #fef2f2 0%, #fff1f2 100%)' }}>
      <div style={{ padding: '1rem 1.25rem', borderBottom: ok ? '1px solid #fed7aa' : '1px solid #fecaca' }}>
        <div className="flex items-center gap-2">
          <span style={{ fontSize: '1.125rem', fontWeight: 700, color: ok ? '#ea580c' : '#dc2626' }}>{result.label || '工具执行'}</span>
          {ok ? <CheckCircle size={18} style={{ color: '#16a34a' }} /> : <AlertCircle size={18} style={{ color: '#dc2626' }} />}
        </div>
      </div>
      <div style={{ padding: '1rem 1.25rem', fontSize: '1rem' }}>
        {result.error && <p style={{ color: '#dc2626' }}>{result.error}</p>}
        {result.summary && <p style={{ color: '#111827', fontWeight: 500 }}>{result.summary}</p>}
      </div>
    </div>
  );
}

function BriefCard({ icon: Icon, title, value, subtitle, tone = 'warm' }) {
  const tones = {
    warm: { background: 'linear-gradient(135deg,#fff7ed 0%,#fffbeb 100%)', border: '#fed7aa', iconBg: '#fb923c' },
    calm: { background: 'linear-gradient(135deg,#f0fdf4 0%,#ecfeff 100%)', border: '#bbf7d0', iconBg: '#14b8a6' },
    safe: { background: 'linear-gradient(135deg,#fefce8 0%,#fff7ed 100%)', border: '#fde68a', iconBg: '#f59e0b' },
    alert: { background: 'linear-gradient(135deg,#fef2f2 0%,#fff7ed 100%)', border: '#fecaca', iconBg: '#ef4444' },
  };
  const current = tones[tone] || tones.warm;

  return (
    <div className="rounded-[1.5rem]" style={{ padding: '1.1rem 1.15rem', background: current.background, border: `1.5px solid ${current.border}` }}>
      <div className="flex items-center gap-3" style={{ marginBottom: '0.75rem' }}>
        <div className="w-11 h-11 rounded-2xl flex items-center justify-center text-white" style={{ background: current.iconBg }}>
          <Icon size={20} />
        </div>
        <span style={{ fontSize: '1rem', color: '#6b7280', fontWeight: 700 }}>{title}</span>
      </div>
      <p style={{ fontSize: '1.125rem', fontWeight: 700, color: '#111827', lineHeight: 1.6 }}>{value}</p>
      {subtitle && <p style={{ fontSize: '0.98rem', color: '#6b7280', marginTop: '0.45rem', lineHeight: 1.6 }}>{subtitle}</p>}
    </div>
  );
}

export default function ElderAdvisor() {
  const location = useLocation();
  const [input, setInput] = useState('');
  const [autoSpeak, setAutoSpeak] = useState(true);
  const [briefing, setBriefing] = useState(false);
  const [briefSnapshot, setBriefSnapshot] = useState(null);
  const [pageError, setPageError] = useState('');
  const msgEnd = useRef(null);
  const isActiveRoute = location.pathname === '/app/elder';
  const { messages, setMessages, loading, speaking, send, stop, speak } = useChatStream({
    mode: 'elder',
    instructions: ELDER_TTS_INSTRUCTIONS,
    autoSpeakFirst: autoSpeak,
    isActive: isActiveRoute,
    initialMessages: ELDER_WELCOME_MESSAGES,
  });

  useEffect(() => {
    msgEnd.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = (text) => {
    const content = (text || input || '').trim();
    if (!content) return;
    setPageError('');
    send(content);
    setInput('');
  };

  const handleTodayBrief = async () => {
    if (briefing) return;
    setBriefing(true);
    setPageError('');
    try {
      stop();
      const res = await api.get('/llm/elder-brief');
      setBriefSnapshot(res.brief || null);
      setMessages(prev => [...prev, { role: 'ai', content: res.message || '', tool_calls: [] }]);
      if (res.message) {
        await speak(res.message);
      }
    } catch (err) {
      setPageError(err.detail || '今日播报生成失败，请稍后重试');
    } finally {
      setBriefing(false);
    }
  };

  const summaryCards = [
    {
      icon: Wallet,
      title: '账户余额',
      value: briefSnapshot ? `${briefSnapshot.balance?.toFixed(2) || '0.00'} GMC` : '点击今日播报查看',
      subtitle: briefSnapshot ? '播报里会用更简单的话慢慢告诉您。' : '系统会读取真实余额并播报。',
      tone: 'warm',
    },
    {
      icon: Activity,
      title: '最近资金变化',
      value: briefSnapshot?.transaction?.summary || '最近资金情况还没有读取',
      subtitle: '会结合最近一笔真实记录说明收入或支出。',
      tone: 'calm',
    },
    {
      icon: HeartHandshake,
      title: '家人 / 社区动态',
      value: briefSnapshot?.family_update?.summary || '点一下今日播报，我来帮您看看最近的新动态。',
      subtitle: '优先读取家人动态，没有时会补充社区真实动态。',
      tone: 'safe',
    },
    {
      icon: Bell,
      title: '今日提醒',
      value: briefSnapshot?.risk?.summary || '今天的提醒还没生成，我会根据账户真实情况来提醒您。',
      subtitle: '重点提醒大额变动、高波动标的和稳健建议。',
      tone: briefSnapshot?.risk?.level === 'attention' ? 'alert' : 'safe',
    },
  ];

  return (
    <div className="senior-ui" style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
      <section className="rounded-[2rem]" style={{ background: 'linear-gradient(135deg,#fff7ed 0%,#fffbeb 45%,#fff1f2 100%)', border: '1.5px solid #fed7aa', padding: '1.5rem' }}>
        <div className="flex items-start justify-between flex-wrap" style={{ gap: '1.25rem' }}>
          <div style={{ flex: '1 1 22rem', minWidth: 0 }}>
            <div className="flex items-center gap-3" style={{ marginBottom: '0.9rem' }}>
              <div className="w-14 h-14 rounded-[1.35rem] flex items-center justify-center text-white" style={{ background: 'linear-gradient(135deg,#fb923c,#f97316)' }}>
                <HeartHandshake size={28} />
              </div>
              <div>
                <h1 style={{ fontSize: '2.1rem', fontWeight: 800, color: '#111827', lineHeight: 1.2 }}>老年理财顾问</h1>
                <p style={{ fontSize: '1.1rem', color: '#6b7280', marginTop: '0.2rem' }}>稳稳当当看账户，清清楚楚听建议</p>
              </div>
            </div>
            <p style={{ fontSize: '1.18rem', color: '#7c2d12', lineHeight: 1.9, maxWidth: '48rem' }}>
              您不用记很多专业词，也不用着急点很多页面。
              我可以先帮您做“今日播报”，再用最简单的话，慢慢讲清楚余额、动态和风险提醒。
            </p>
          </div>

          <div style={{ flex: '0 0 18rem', minWidth: '17rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <button
              onClick={handleTodayBrief}
              disabled={briefing}
              className="rounded-[1.6rem] text-left"
              style={{
                padding: '1rem 1.1rem',
                background: 'linear-gradient(135deg,#f97316 0%,#ea580c 100%)',
                color: '#ffffff',
                boxShadow: '0 14px 30px rgba(249,115,22,0.18)',
              }}
            >
              <div className="flex items-center justify-between" style={{ marginBottom: '0.4rem' }}>
                <span style={{ fontSize: '1.35rem', fontWeight: 800 }}>今日播报</span>
                <Bell size={22} />
              </div>
              <p style={{ fontSize: '1rem', lineHeight: 1.7, opacity: 0.96 }}>
                {briefing ? '正在读取真实数据并生成播报…' : '一键读取真实数据，整理成今天的温馨播报并自动朗读。'}
              </p>
            </button>

            <div className="flex items-center gap-2 flex-wrap">
              {speaking && (
                <button onClick={stop} className="flex items-center gap-2 px-4 py-2.5 rounded-2xl" style={{ background: '#fef2f2', color: '#ef4444', border: '1.5px solid #fecaca', fontSize: '1rem', fontWeight: 700 }}>
                  <Square size={16} />
                  停止朗读
                </button>
              )}
              <button
                onClick={() => {
                  setAutoSpeak(s => !s);
                  if (speaking) stop();
                }}
                className="flex items-center gap-2 px-4 py-2.5 rounded-2xl"
                style={{ background: autoSpeak ? '#ffffff' : '#fff7ed', color: '#c2410c', border: '1.5px solid #fdba74', fontSize: '1rem', fontWeight: 700 }}
                aria-label="切换语音朗读"
              >
                {autoSpeak ? <Volume2 size={18} /> : <VolumeX size={18} />}
                {autoSpeak ? '自动朗读已开' : '自动朗读已关'}
              </button>
            </div>
          </div>
        </div>
      </section>

      {pageError && (
        <div className="rounded-2xl" style={{ padding: '1rem 1.1rem', background: '#fef2f2', border: '1.5px solid #fecaca', color: '#b91c1c', fontSize: '1rem' }}>
          {pageError}
        </div>
      )}

      <section className="grid grid-cols-1 xl:grid-cols-4 md:grid-cols-2" style={{ gap: '1rem' }}>
        {summaryCards.map(card => <BriefCard key={card.title} {...card} />)}
      </section>

      <section className="rounded-[2rem]" style={{ background: '#fffdf8', border: '1.5px solid #fde68a', padding: '1.2rem' }}>
        <div className="flex items-center gap-3" style={{ marginBottom: '1rem' }}>
          <div className="w-12 h-12 rounded-[1rem] flex items-center justify-center text-white" style={{ background: 'linear-gradient(135deg,#f59e0b,#f97316)' }}>
            <ShieldCheck size={24} />
          </div>
          <div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#111827' }}>常用贴心服务</h2>
            <p style={{ fontSize: '1rem', color: '#6b7280', marginTop: '0.2rem' }}>常用问题做成大按钮，少打字也能直接问。</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4" style={{ gap: '0.9rem' }}>
          {QUICK_ACTIONS.map(action => (
            <button
              key={action.label}
              onClick={() => handleSend(action.message)}
              className="text-left rounded-[1.5rem] transition-all"
              style={{
                padding: '1rem 1.05rem',
                background: '#ffffff',
                border: '1.5px solid #f3f4f6',
                boxShadow: '0 6px 20px rgba(15,23,42,0.04)',
              }}
            >
              <div className="flex items-center gap-3" style={{ marginBottom: '0.55rem' }}>
                <div className="w-11 h-11 rounded-[1rem] flex items-center justify-center text-white" style={{ background: action.accent }}>
                  <action.icon size={20} />
                </div>
                <span style={{ fontSize: '1.18rem', fontWeight: 800, color: '#111827' }}>{action.label}</span>
              </div>
              <p style={{ fontSize: '1rem', color: '#6b7280', lineHeight: 1.7 }}>
                {action.label === '查余额' && '帮您直接看今天有多少国脉币。'}
                {action.label === '看家人动态' && '看看最近有没有值得您关心的新消息。'}
                {action.label === '风险提醒' && '把复杂风险翻译成容易听懂的话。'}
                {action.label === '慢慢讲给我听' && '把理财建议讲得更慢、更简单。'}
              </p>
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-[2rem]" style={{ background: '#ffffff', border: '1.5px solid #fed7aa', padding: '1.2rem' }}>
        <div className="flex items-center gap-3" style={{ marginBottom: '1rem' }}>
          <div className="w-12 h-12 rounded-[1rem] flex items-center justify-center text-white" style={{ background: 'linear-gradient(135deg,#f97316,#ea580c)' }}>
            <Bot size={22} />
          </div>
          <div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#111827' }}>顾问对话记录</h2>
            <p style={{ fontSize: '1rem', color: '#6b7280', marginTop: '0.2rem' }}>您问过什么、我怎么回答，都会放在这里，方便回头再看。</p>
          </div>
        </div>

        <div className="rounded-[1.6rem]" style={{ minHeight: '24rem', padding: '1rem', background: '#fffdf9', border: '1px solid #ffedd5' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {messages.map((m, i) => (
              <div key={i} className={`flex items-start gap-3 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-white flex-shrink-0" style={{ background: m.role === 'user' ? '#111827' : 'linear-gradient(135deg,#f97316,#ea580c)' }}>
                  {m.role === 'user' ? <User size={20} /> : <Bot size={20} />}
                </div>
                <div style={{ maxWidth: '86%', minWidth: 0, padding: '1rem 1.1rem', borderRadius: '1.2rem', background: m.role === 'user' ? '#fff7ed' : '#ffffff', border: `1px solid ${m.role === 'user' ? '#fed7aa' : '#e5e7eb'}`, fontSize: '1.18rem', lineHeight: 1.8, color: '#111827', wordBreak: 'break-word', overflowWrap: 'break-word' }}>
                  {m.role === 'ai' ? (
                    <div className="leading-relaxed [&_p]:my-1 [&_ul]:my-1 [&_ol]:my-1 [&_li]:my-0.5 [&_strong]:font-semibold [&_code]:bg-orange-50 [&_code]:px-1 [&_code]:rounded [&_code]:text-orange-600 [&_blockquote]:border-l-4 [&_blockquote]:border-orange-300 [&_blockquote]:pl-3 [&_blockquote]:italic">
                      {m.tool_calls?.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: m.content ? '1rem' : 0 }}>
                          {m.tool_calls.map((tc, ti) => <ToolResultBlock key={ti} result={tc.result} />)}
                        </div>
                      )}
                      {m.content ? (
                        <ReactMarkdown>{m.content || ''}</ReactMarkdown>
                      ) : loading && i === messages.length - 1 ? (
                        <div className="flex gap-1.5 py-1">
                          <div className="w-2 h-2 bg-orange-300 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                          <div className="w-2 h-2 bg-orange-300 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                          <div className="w-2 h-2 bg-orange-300 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <span style={{ whiteSpace: 'pre-wrap' }}>{m.content}</span>
                  )}
                </div>
              </div>
            ))}
            <div ref={msgEnd} />
          </div>
        </div>

        <div className="flex gap-3 items-end" style={{ marginTop: '1rem', flexWrap: 'wrap' }}>
          <input
            type="text"
            className="input-field"
            placeholder="比如：今天我该注意什么？或者：慢慢给我讲讲余额。"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') handleSend();
            }}
            style={{ fontSize: '1.18rem', flex: '1 1 22rem', minWidth: '16rem' }}
          />
          <button onClick={() => handleSend()} disabled={!input.trim()} className="btn-primary" style={{ minWidth: '8rem', fontSize: '1.06rem' }}>
            <Send size={20} />
            发送
          </button>
        </div>
      </section>

      <p style={{ fontSize: '1rem', color: '#6b7280', textAlign: 'center', lineHeight: 1.8 }}>
        温馨提示：本顾问以稳健、易懂、适合长者理解为优先，不会主动推荐期货、杠杆等高风险产品。
      </p>
    </div>
  );
}
