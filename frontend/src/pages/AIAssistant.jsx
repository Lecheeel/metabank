import { useState, useEffect, useRef } from 'react';
import api from '../utils/api';
import { Bot, Send, Clock, Trash2, Zap, TrendingUp, Wallet, Timer } from 'lucide-react';

export default function AIAssistant() {
  const [messages, setMessages] = useState([
    { role: 'ai', content: '👋 您好！我是MetaBank AI智能助手，基于大语言模型(LLM)技术，为您提供智能金融服务。\n\n我可以帮您：\n- 💰 查询资产余额\n- 📈 分析市场行情和价格预测\n- 🛒 快捷买卖操作\n- 💸 代币转账\n- ⏰ 设置自动交易任务\n\n请问您需要什么帮助？' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [autoTasks, setAutoTasks] = useState([]);
  const [tab, setTab] = useState('chat');
  const [taskForm, setTaskForm] = useState({ symbol: 'GMAI', action: 'buy', amount: '', target_price: '', interval_minutes: '60', repeat: '5', task_type: 'dca' });
  const msgEnd = useRef(null);

  useEffect(() => {
    api.get('/llm/auto-tasks').then(setAutoTasks).catch(() => {});
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
      const res = await api.post('/llm/chat', { message: userMsg });
      setMessages(prev => [...prev, { role: 'ai', content: res.ai_response }]);
    } catch {
      setMessages(prev => [...prev, { role: 'ai', content: '抱歉，AI助手暂时无法响应，请稍后再试。' }]);
    }
    setLoading(false);
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

  const quickPrompts = [
    { icon: Wallet, label: '查看余额', prompt: '查看我的余额' },
    { icon: TrendingUp, label: '市场分析', prompt: '分析今日行情走势' },
    { icon: Zap, label: '买入GMAI', prompt: '帮我买入100份国脉AI概念股' },
    { icon: Timer, label: '设置定投', prompt: '设置每天定投GMAI 50份' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
            <Bot size={22} className="text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">AI 智能助手</h1>
            <p className="text-xs text-white/40">LLM驱动 · 智能交易 · 市场预测</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setTab('chat')} className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${tab === 'chat' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'text-white/50'}`}>
            AI对话
          </button>
          <button onClick={() => setTab('tasks')} className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${tab === 'tasks' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'text-white/50'}`}>
            <Clock size={14} className="inline mr-1" />自动任务
          </button>
        </div>
      </div>

      {tab === 'chat' && (
        <div className="flex flex-col h-[calc(100vh-14rem)]">
          <div className="flex gap-2 mb-3 flex-wrap">
            {quickPrompts.map((q, i) => (
              <button key={i} onClick={() => { setInput(q.prompt); }} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs bg-white/5 border border-white/10 text-white/60 hover:text-white hover:bg-white/10 transition-all">
                <q.icon size={12} />{q.label}
              </button>
            ))}
          </div>

          <div className="flex-1 card overflow-y-auto p-4 space-y-4">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-2xl ${m.role === 'user' ? '' : ''}`}>
                  {m.role === 'ai' && (
                    <div className="flex items-center gap-2 mb-1.5">
                      <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
                        <Bot size={14} className="text-white" />
                      </div>
                      <span className="text-xs text-white/40">MetaBank AI</span>
                    </div>
                  )}
                  <div className={`px-4 py-3 rounded-2xl ${m.role === 'user' ? 'bg-indigo-500/20 border border-indigo-500/20 rounded-br-md' : 'bg-white/5 border border-white/10 rounded-bl-md'}`}>
                    <div className="text-sm whitespace-pre-wrap leading-relaxed">{m.content}</div>
                  </div>
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-white/5 border border-white/10 rounded-2xl rounded-bl-md px-4 py-3">
                  <div className="flex gap-1.5">
                    <div className="w-2 h-2 bg-white/30 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-2 h-2 bg-white/30 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-2 h-2 bg-white/30 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={msgEnd} />
          </div>

          <div className="flex gap-2 mt-3">
            <input className="input-field flex-1" placeholder="向AI助手提问... 例如：帮我分析国脉科技的走势" value={input}
              onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendMessage()} />
            <button onClick={sendMessage} disabled={loading} className="btn-primary px-4">
              <Send size={18} />
            </button>
          </div>
        </div>
      )}

      {tab === 'tasks' && (
        <div className="space-y-6">
          <div className="card space-y-4">
            <h3 className="font-semibold flex items-center gap-2"><Zap size={18} className="text-amber-400" />创建自动任务</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-white/50 mb-1">任务类型</label>
                <select className="input-field text-sm" value={taskForm.task_type} onChange={e => setTaskForm({...taskForm, task_type: e.target.value})}>
                  <option value="dca">定时定投 (DCA)</option>
                  <option value="price_trigger">价格触发</option>
                  <option value="timed">定时加仓</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-white/50 mb-1">交易标的</label>
                <select className="input-field text-sm" value={taskForm.symbol} onChange={e => setTaskForm({...taskForm, symbol: e.target.value})}>
                  <option value="GM">国脉科技</option>
                  <option value="GMAI">国脉AI概念</option>
                  <option value="GMC">国脉币</option>
                  <option value="GMFT">国脉币期货</option>
                  <option value="METAV">元宇宙指数</option>
                  <option value="AIFIN">AI金融ETF</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-white/50 mb-1">操作</label>
                <select className="input-field text-sm" value={taskForm.action} onChange={e => setTaskForm({...taskForm, action: e.target.value})}>
                  <option value="buy">买入</option>
                  <option value="sell">卖出</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-white/50 mb-1">数量（份）</label>
                <input type="number" className="input-field text-sm" placeholder="100" value={taskForm.amount} onChange={e => setTaskForm({...taskForm, amount: e.target.value})} />
              </div>
              {taskForm.task_type === 'price_trigger' && (
                <div>
                  <label className="block text-xs text-white/50 mb-1">目标价格</label>
                  <input type="number" step="0.01" className="input-field text-sm" placeholder="11.5" value={taskForm.target_price} onChange={e => setTaskForm({...taskForm, target_price: e.target.value})} />
                </div>
              )}
              <div>
                <label className="block text-xs text-white/50 mb-1">间隔（分钟）</label>
                <input type="number" className="input-field text-sm" placeholder="60" value={taskForm.interval_minutes} onChange={e => setTaskForm({...taskForm, interval_minutes: e.target.value})} />
              </div>
              <div>
                <label className="block text-xs text-white/50 mb-1">重复次数</label>
                <input type="number" className="input-field text-sm" placeholder="5" value={taskForm.repeat} onChange={e => setTaskForm({...taskForm, repeat: e.target.value})} />
              </div>
            </div>
            <button onClick={createAutoTask} className="btn-primary">创建任务</button>
          </div>

          <div>
            <h3 className="font-semibold mb-3">我的自动任务</h3>
            <div className="space-y-2">
              {autoTasks.map(t => (
                <div key={t.id} className="card flex items-center justify-between py-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${t.status === 'active' ? 'bg-green-500/15 text-green-400' : 'bg-white/5 text-white/30'}`}>
                      <Clock size={20} />
                    </div>
                    <div>
                      <p className="text-sm font-medium">
                        {t.task_type === 'dca' ? '定投' : t.task_type === 'price_trigger' ? '价格触发' : '定时'}
                        {' '}{t.action === 'buy' ? '买入' : '卖出'} {t.symbol} {t.amount}份
                      </p>
                      <p className="text-xs text-white/40">
                        每{t.interval_minutes}分钟 · 已执行{t.executed}/{t.repeat}次
                        {t.target_price ? ` · 目标价: ${t.target_price}` : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-1 rounded-full ${t.status === 'active' ? 'bg-green-500/15 text-green-400' : 'bg-white/10 text-white/30'}`}>
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
              {autoTasks.length === 0 && <div className="card text-center text-white/40 py-8">暂无自动任务</div>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
