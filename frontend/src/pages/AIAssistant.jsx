import { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import api from '../utils/api';
import { Bot, Send, Clock, Trash2, Zap, TrendingUp, Wallet, Timer, Settings, Eye, EyeOff, Key, CheckCircle, AlertCircle, User } from 'lucide-react';

/** 工具调用结果块：在对话框内显著展示 */
function ToolResultBlock({ result }) {
  if (!result) return null;
  const ok = result.success;
  const label = result.label || '工具执行';
  const data = result.data || {};
  const summary = result.summary;
  const err = result.error;

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{
        border: `2px solid ${ok ? '#fcd34d' : '#fca5a5'}`,
        background: ok ? 'linear-gradient(135deg, #fffbeb 0%, #fff7ed 100%)' : 'linear-gradient(135deg, #fef2f2 0%, #fff1f2 100%)',
        boxShadow: '0 2px 8px rgba(249, 115, 22, 0.15)',
      }}
    >
      <div style={{ padding: '1rem 1.25rem', borderBottom: ok ? '1px solid #fed7aa' : '1px solid #fecaca' }}>
        <div className="flex items-center gap-2">
          <span style={{ fontSize: '1.125rem', fontWeight: 600, color: ok ? '#ea580c' : '#dc2626' }}>
            {label}
          </span>
          {ok ? (
            <CheckCircle size={18} style={{ color: '#16a34a' }} />
          ) : (
            <AlertCircle size={18} style={{ color: '#dc2626' }} />
          )}
        </div>
      </div>
      <div style={{ padding: '1rem 1.25rem', fontSize: '1rem' }}>
        {err && <p style={{ color: '#dc2626', marginBottom: '0.5rem' }}>{err}</p>}
        {ok && summary && <p style={{ color: '#111827', fontWeight: 500, marginBottom: '0.5rem' }}>{summary}</p>}
        {ok && data.balance !== undefined && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <p style={{ fontSize: '1.25rem', fontWeight: 700, color: '#ea580c' }}>{data.balance?.toLocaleString()} GMC</p>
            <p style={{ fontSize: '1rem', color: '#6b7280', fontFamily: 'monospace' }}>{data.wallet_address}</p>
          </div>
        )}
        {ok && data.items && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {data.items.slice(0, 6).map((it, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem', background: 'rgba(255,255,255,0.6)', borderRadius: '8px' }}>
                <span style={{ fontWeight: 500 }}>{it.name} ({it.symbol})</span>
                <span style={{ color: '#ea580c', fontWeight: 600 }}>{it.price} · {it.trend}</span>
              </div>
            ))}
          </div>
        )}
        {ok && data.total_cost !== undefined && (
          <div style={{ marginTop: '0.5rem' }}>
            <p><strong>{data.name}</strong> {data.amount}份 @ {data.price} = {data.total_cost?.toFixed(2)} GMC</p>
            <p style={{ color: '#16a34a', fontWeight: 600 }}>新余额：{data.new_balance?.toLocaleString()} GMC</p>
          </div>
        )}
        {ok && data.task_id && (
          <p style={{ marginTop: '0.5rem', fontSize: '1rem', color: '#6b7280' }}>任务ID：{data.task_id}</p>
        )}
        {ok && data.interval_minutes && (
          <p style={{ marginTop: '0.25rem', fontSize: '1.0625rem', color: '#6b7280' }}>
            每{data.interval_minutes}分钟定投{data.name} {data.amount}份，共{data.repeat}次
          </p>
        )}
        {ok && data.posts && (
          <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <p style={{ fontWeight: 600, marginBottom: '0.25rem' }}>{data.nickname} 的最近动态（共{data.total}条）</p>
            {data.posts.slice(0, 8).map((p, i) => (
              <div key={i} style={{ padding: '0.75rem', background: 'rgba(255,255,255,0.7)', borderRadius: '8px', border: '1px solid #f3f4f6' }}>
                <p style={{ marginBottom: '0.25rem' }}>{p.content}</p>
                <div style={{ fontSize: '0.9375rem', color: '#6b7280' }}>
                  {p.type === 'sport' && p.gmc_earned && <span style={{ color: '#ea580c', fontWeight: 600 }}>+{p.gmc_earned} GMC </span>}
                  {p.type === 'shop' && p.product && <span>🛒 {p.product} {p.price}GMC </span>}
                  {p.type === 'trade' && p.symbol && <span>📈 {p.action === 'buy' ? '买入' : '卖出'} {p.symbol} {p.amount}份 </span>}
                  <span>{p.created_at ? new Date(p.created_at).toLocaleString('zh-CN') : ''}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function AIAssistant() {
  const [messages, setMessages] = useState([
    { role: 'ai', content: '👋 您好！我是MetaBank AI智能助手，基于 Qwen 大语言模型(LLM)技术，为您提供智能金融服务。\n\n我可以帮您：\n- 💰 查询资产余额\n- 📈 分析市场行情和价格预测\n- 👀 查看社区用户最近动态（如：帮我看看老张头最近在干嘛）\n- 🛒 快捷买卖操作\n- 💸 代币转账\n- ⏰ 设置自动交易任务\n\n请问您需要什么帮助？' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [autoTasks, setAutoTasks] = useState([]);
  const [tab, setTab] = useState('chat');
  const [taskForm, setTaskForm] = useState({ symbol: 'GMAI', action: 'buy', amount: '', target_price: '', interval_minutes: '60', repeat: '5', task_type: 'dca' });
  const [llmStatus, setLlmStatus] = useState(null);
  const [showKeyConfig, setShowKeyConfig] = useState(false);
  const [userApiKey, setUserApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [savedUserKey, setSavedUserKey] = useState('');
  const msgEnd = useRef(null);

  useEffect(() => {
    api.get('/llm/auto-tasks').then(setAutoTasks).catch(() => {});
    api.get('/llm/status').then(setLlmStatus).catch(() => {});
    const saved = localStorage.getItem('user_dashscope_key');
    if (saved) setSavedUserKey(saved);
  }, []);

  useEffect(() => {
    msgEnd.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim()) return;
    const userMsg = input;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setLoading(true);
    try {
      const payload = { message: userMsg };
      if (savedUserKey) {
        payload.api_key = savedUserKey;
      }
      const res = await api.post('/llm/chat', payload);
      setMessages(prev => [...prev, {
        role: 'ai',
        content: res.ai_response,
        model: res.model,
        tool_calls: res.tool_calls || [],
      }]);
      if (res.tool_calls?.some(tc => tc.result?.tool === 'set_dca_task' || tc.result?.tool === 'buy_stock')) {
        api.get('/llm/auto-tasks').then(setAutoTasks).catch(() => {});
      }
    } catch {
      setMessages(prev => [...prev, { role: 'ai', content: '抱歉，AI助手暂时无法响应，请稍后再试。' }]);
    }
    setLoading(false);
  };

  const handleSaveUserKey = () => {
    if (userApiKey.trim()) {
      localStorage.setItem('user_dashscope_key', userApiKey.trim());
      setSavedUserKey(userApiKey.trim());
      setUserApiKey('');
      setShowKeyConfig(false);
    }
  };

  const handleClearUserKey = () => {
    localStorage.removeItem('user_dashscope_key');
    setSavedUserKey('');
  };

  const createAutoTask = async () => {
    try {
      await api.post('/llm/auto-task', {
        ...taskForm,
        amount: parseFloat(taskForm.amount),
        target_price: taskForm.target_price ? parseFloat(taskForm.target_price) : null,
        interval_minutes: parseInt(taskForm.interval_minutes),
        repeat: parseInt(taskForm.repeat)
      });
      api.get('/llm/auto-tasks').then(setAutoTasks);
      setTaskForm({ symbol: 'GMAI', action: 'buy', amount: '', target_price: '', interval_minutes: '60', repeat: '5', task_type: 'dca' });
    } catch (err) {
      alert(err.detail || '创建失败');
    }
  };

  const cancelTask = async (id) => {
    await api.delete(`/llm/auto-task/${id}`);
    api.get('/llm/auto-tasks').then(setAutoTasks);
  };

  const isQwenActive = llmStatus?.has_api_key || !!savedUserKey;

  const quickPrompts = [
    { icon: Wallet, label: '查看余额', prompt: '查看我的余额' },
    { icon: TrendingUp, label: '市场分析', prompt: '分析今日行情走势' },
    { icon: User, label: '查用户动态', prompt: '帮我看看老张头最近在干嘛' },
    { icon: Zap, label: '买入GMAI', prompt: '帮我买入100份国脉AI概念股' },
    { icon: Timer, label: '设置定投', prompt: '设置每天定投GMAI 50份' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
      <div className="flex items-center justify-between flex-wrap" style={{ gap: '0.75rem' }}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg,#f59e0b,#f97316)' }}>
            <Bot size={22} className="text-white" />
          </div>
          <div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: '#111827' }}>AI 智能助手</h1>
            <div className="flex items-center gap-2" style={{ marginTop: '0.25rem' }}>
              {isQwenActive ? (
                <span className="flex items-center gap-1" style={{ fontSize: '1.0625rem', color: '#16a34a' }}>
                  <CheckCircle size={14} />
                  Qwen {llmStatus?.model || 'qwen3.5-flash'} 已启用
                </span>
              ) : (
                <span className="flex items-center gap-1" style={{ fontSize: '1.0625rem', color: '#6b7280' }}>
                  <AlertCircle size={14} />
                  本地模式（未配置 API Key）
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowKeyConfig(!showKeyConfig)}
            className="px-4 py-2 rounded-xl font-medium transition-all flex items-center gap-1.5"
            style={{ fontSize: '1.0625rem', ...(showKeyConfig ? { background: '#fff7ed', color: '#ea580c', border: '1px solid #fed7aa' } : { color: '#6b7280', border: '1px solid #e5e7eb' }) }}
          >
            <Key size={12} />API Key
          </button>
          <button onClick={() => setTab('chat')} className="px-4 py-2 rounded-xl font-medium transition-all" style={{ fontSize: '1rem', ...(tab === 'chat' ? { background: '#fff7ed', color: '#ea580c', border: '1px solid #fcd34d' } : { color: '#6b7280', border: '1px solid transparent' }) }}>
            AI对话
          </button>
          <button onClick={() => setTab('tasks')} className="px-4 py-2 rounded-xl font-medium transition-all flex items-center gap-1" style={{ fontSize: '1rem', ...(tab === 'tasks' ? { background: '#fff7ed', color: '#ea580c', border: '1px solid #fcd34d' } : { color: '#6b7280', border: '1px solid transparent' }) }}>
            <Clock size={16} />自动任务
          </button>
        </div>
      </div>

      {showKeyConfig && (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div className="flex items-center justify-between">
            <h3 className="font-semibold flex items-center gap-2" style={{ fontSize: '1.0625rem' }}>
              <Key size={16} className="text-orange-500" />
              个人 API Key 配置
            </h3>
            <button onClick={() => setShowKeyConfig(false)} className="text-gray-400 hover:text-gray-900" style={{ fontSize: '1.25rem' }}>&times;</button>
          </div>
          <p style={{ fontSize: '1.0625rem', color: '#6b7280' }}>
            配置您自己的 DashScope API Key，优先级高于管理员配置。
            前往 <a href="https://dashscope.console.aliyun.com/" target="_blank" rel="noopener" className="text-orange-500 underline">阿里云 DashScope</a> 获取。
          </p>

          {savedUserKey ? (
            <div className="flex items-center justify-between bg-green-500/5 border border-green-500/20 rounded-xl px-4 py-3">
              <div className="flex items-center gap-2">
                <CheckCircle size={16} className="text-green-400" />
                <span className="text-green-400" style={{ fontSize: '1.0625rem' }}>已配置个人 API Key</span>
                <span className="font-mono">{savedUserKey.slice(0, 6)}...{savedUserKey.slice(-4)}</span>
              </div>
              <button onClick={handleClearUserKey} className="text-red-400/60 hover:text-red-400">清除</button>
            </div>
          ) : (
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type={showApiKey ? 'text' : 'password'}
                  className="input-field pr-10 font-mono"
                  placeholder="输入您的 DashScope API Key (sk-...)"
                  value={userApiKey}
                  onChange={e => setUserApiKey(e.target.value)}
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-500"
                  onClick={() => setShowApiKey(!showApiKey)}
                >
                  {showApiKey ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              <button onClick={handleSaveUserKey} className="btn-primary px-5">保存</button>
            </div>
          )}
          <p style={{ fontSize: '1rem', color: '#9ca3af' }}>Key 仅存储在浏览器本地，不会上传到服务器</p>
        </div>
      )}

      {tab === 'chat' && (
        <div className="flex flex-col h-[calc(100vh-14rem)]">
          <div className="flex flex-wrap" style={{ gap: '0.75rem', marginBottom: '1rem' }}>
            {quickPrompts.map((q, i) => (
              <button key={i} onClick={() => { setInput(q.prompt); }} className="flex items-center gap-2 rounded-full bg-gray-50 border border-gray-200 text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-all" style={{ padding: '0.5rem 1rem', fontSize: '1rem' }}>
                <q.icon size={16} />{q.label}
              </button>
            ))}
          </div>

          <div className="flex-1 card overflow-y-auto" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className="max-w-2xl">
                  {m.role === 'ai' && (
                    <div className="flex items-center gap-2 mb-1.5">
                      <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
                        <Bot size={14} className="text-white" />
                      </div>
                      <span className="text-gray-400">MetaBank AI</span>
                      {m.model && (
                        <span className={`text-xs px-1.5 py-0.5 rounded ${m.model === 'local' ? 'bg-gray-50 text-gray-400' : 'bg-green-500/10 text-green-400'}`}>
                          {m.model === 'local' ? '本地' : m.model}
                        </span>
                      )}
                    </div>
                  )}
                  <div className={`rounded-2xl ${m.role === 'user' ? 'bg-orange-50 border border-orange-100 rounded-br-md' : 'bg-gray-50 border border-gray-200 rounded-bl-md'}`} style={{ padding: '1rem 1.25rem' }}>
                    {m.role === 'ai' ? (
                      <>
                        {m.tool_calls?.length > 0 && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1rem' }}>
                            {m.tool_calls.map((tc, ti) => (
                              <ToolResultBlock key={ti} result={tc.result} />
                            ))}
                          </div>
                        )}
                        <div className="leading-relaxed [&_p]:my-1 [&_ul]:my-1 [&_ol]:my-1 [&_li]:my-0.5 [&_strong]:font-semibold [&_code]:bg-gray-200 [&_code]:px-1 [&_code]:rounded [&_code]:text-orange-600 [&_pre]:bg-gray-100 [&_pre]:p-3 [&_pre]:rounded-lg [&_pre]:overflow-x-auto [&_pre]:text-sm [&_h1]:text-xl [&_h2]:text-lg [&_h3]:text-base [&_blockquote]:border-l-4 [&_blockquote]:border-orange-300 [&_blockquote]:pl-3 [&_blockquote]:italic [&_blockquote]:text-gray-600" style={{ fontSize: '1.0625rem' }}>
                          <ReactMarkdown>{m.content}</ReactMarkdown>
                        </div>
                      </>
                    ) : (
                      <div className="whitespace-pre-wrap" style={{ fontSize: '1.0625rem' }}>{m.content}</div>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-gray-50 border border-gray-200 rounded-2xl rounded-bl-md px-4 py-3">
                  <div className="flex gap-1.5">
                    <div className="w-2 h-2 bg-orange-300 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-2 h-2 bg-orange-300 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-2 h-2 bg-orange-300 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={msgEnd} />
          </div>

          <div className="flex mt-4" style={{ gap: '0.75rem' }}>
            <input className="input-field flex-1" placeholder="向AI助手提问... 例如：帮我分析国脉科技的走势" value={input}
              onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendMessage()} style={{ fontSize: '1.0625rem' }} />
            <button onClick={sendMessage} disabled={loading} className="btn-primary px-4">
              <Send size={18} />
            </button>
          </div>
        </div>
      )}

      {tab === 'tasks' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <h3 className="font-semibold flex items-center gap-2" style={{ fontSize: '1.125rem' }}><Zap size={20} className="text-amber-400" />创建自动任务</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3" style={{ gap: '1rem' }}>
              <div>
                <label className="block mb-1" style={{ fontSize: '1rem', color: '#6b7280' }}>任务类型</label>
                <select className="input-field" value={taskForm.task_type} onChange={e => setTaskForm({...taskForm, task_type: e.target.value})} style={{ fontSize: '1.0625rem' }}>
                  <option value="dca">定时定投 (DCA)</option>
                  <option value="price_trigger">价格触发</option>
                  <option value="timed">定时加仓</option>
                </select>
              </div>
              <div>
                <label className="block mb-1" style={{ fontSize: '1rem', color: '#6b7280' }}>交易标的</label>
                <select className="input-field" value={taskForm.symbol} onChange={e => setTaskForm({...taskForm, symbol: e.target.value})} style={{ fontSize: '1.0625rem' }}>
                  <option value="GM">国脉科技</option>
                  <option value="GMAI">国脉AI概念</option>
                  <option value="GMC">国脉币</option>
                  <option value="GMFT">国脉币期货</option>
                  <option value="METAV">元宇宙指数</option>
                  <option value="AIFIN">AI金融ETF</option>
                </select>
              </div>
              <div>
                <label className="block mb-1" style={{ fontSize: '1rem', color: '#6b7280' }}>操作</label>
                <select className="input-field" value={taskForm.action} onChange={e => setTaskForm({...taskForm, action: e.target.value})} style={{ fontSize: '1.0625rem' }}>
                  <option value="buy">买入</option>
                  <option value="sell">卖出</option>
                </select>
              </div>
              <div>
                <label className="block mb-1" style={{ fontSize: '1rem', color: '#6b7280' }}>数量（份）</label>
                <input type="number" className="input-field" placeholder="100" value={taskForm.amount} onChange={e => setTaskForm({...taskForm, amount: e.target.value})} style={{ fontSize: '1.0625rem' }} />
              </div>
              {taskForm.task_type === 'price_trigger' && (
                <div>
                  <label className="block mb-1" style={{ fontSize: '1rem', color: '#6b7280' }}>目标价格</label>
                  <input type="number" step="0.01" className="input-field" placeholder="11.5" value={taskForm.target_price} onChange={e => setTaskForm({...taskForm, target_price: e.target.value})} style={{ fontSize: '1.0625rem' }} />
                </div>
              )}
              <div>
                <label className="block mb-1" style={{ fontSize: '1rem', color: '#6b7280' }}>间隔（分钟）</label>
                <input type="number" className="input-field" placeholder="60" value={taskForm.interval_minutes} onChange={e => setTaskForm({...taskForm, interval_minutes: e.target.value})} style={{ fontSize: '1.0625rem' }} />
              </div>
              <div>
                <label className="block mb-1" style={{ fontSize: '1rem', color: '#6b7280' }}>重复次数</label>
                <input type="number" className="input-field" placeholder="5" value={taskForm.repeat} onChange={e => setTaskForm({...taskForm, repeat: e.target.value})} style={{ fontSize: '1.0625rem' }} />
              </div>
            </div>
            <button onClick={createAutoTask} className="btn-primary" style={{ fontSize: '1rem', padding: '0.75rem 1.5rem' }}>创建任务</button>
          </div>

          <div>
            <h3 className="font-semibold" style={{ fontSize: '1.125rem', marginBottom: '1rem' }}>我的自动任务</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {autoTasks.map(t => (
                <div key={t.id} className="card flex items-center justify-between" style={{ padding: '1.25rem' }}>
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${t.status === 'active' ? 'bg-green-500/15 text-green-400' : 'bg-gray-50 text-gray-400'}`}>
                      <Clock size={24} />
                    </div>
                    <div>
                      <p className="font-medium" style={{ fontSize: '1.0625rem' }}>
                        {t.task_type === 'dca' ? '定投' : t.task_type === 'price_trigger' ? '价格触发' : '定时'}
                        {' '}{t.action === 'buy' ? '买入' : '卖出'} {t.symbol} {t.amount}份
                      </p>
                      <p style={{ fontSize: '1.0625rem', color: '#6b7280' }}>
                        每{t.interval_minutes}分钟 · 已执行{t.executed}/{t.repeat}次
                        {t.target_price ? ` · 目标价: ${t.target_price}` : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2.5 py-1 rounded-full ${t.status === 'active' ? 'bg-green-500/15 text-green-400' : 'bg-gray-100 text-gray-400'}`} style={{ fontSize: '1rem' }}>
                      {t.status === 'active' ? '运行中' : '已取消'}
                    </span>
                    {t.status === 'active' && (
                      <button onClick={() => cancelTask(t.id)} className="text-red-400/50 hover:text-red-400">
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {autoTasks.length === 0 && <div className="card text-center text-gray-400 py-8">暂无自动任务</div>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
