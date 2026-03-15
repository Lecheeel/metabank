import { useState, useEffect } from 'react';
import api from '../utils/api';
import { TrendingUp, TrendingDown, BarChart3, Briefcase, History, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';

export default function Exchange() {
  const [stocks, setStocks] = useState([]);
  const [selected, setSelected] = useState(null);
  const [kline, setKline] = useState([]);
  const [portfolio, setPortfolio] = useState(null);
  const [history, setHistory] = useState([]);
  const [tab, setTab] = useState('market');
  const [tradeForm, setTradeForm] = useState({ action: 'buy', amount: '' });
  const [msg, setMsg] = useState('');

  useEffect(() => {
    api.get('/exchange/stocks').then(d => { setStocks(d); if (d.length) setSelected(d[0]); });
    api.get('/exchange/portfolio').then(setPortfolio).catch(() => {});
    api.get('/exchange/history').then(setHistory).catch(() => {});
  }, []);

  useEffect(() => {
    if (selected) {
      api.get(`/exchange/kline/${selected.symbol}`).then(d => setKline(d.data || []));
    }
  }, [selected?.symbol]);

  const handleTrade = async () => {
    if (!selected || !tradeForm.amount) return;
    try {
      const res = await api.post('/exchange/trade', {
        symbol: selected.symbol,
        action: tradeForm.action,
        amount: parseFloat(tradeForm.amount),
        price: selected.current_price
      });
      setMsg(res.message);
      setTradeForm({ ...tradeForm, amount: '' });
      api.get('/exchange/portfolio').then(setPortfolio);
      api.get('/exchange/history').then(setHistory);
      api.get('/exchange/stocks').then(setStocks);
    } catch (err) {
      setMsg(err.detail || '交易失败');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold">交易所</h1>
        <div className="flex gap-2">
          {[['market', '行情', BarChart3], ['portfolio', '持仓', Briefcase], ['history', '历史', History]].map(([k, v, Icon]) => (
            <button key={k} onClick={() => setTab(k)} className={`px-4 py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-1 ${tab === k ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30' : 'text-white/50 hover:text-white'}`}>
              <Icon size={14} />{v}
            </button>
          ))}
        </div>
      </div>

      {msg && (
        <div className="bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 px-4 py-3 rounded-xl text-sm flex justify-between">
          {msg}<button onClick={() => setMsg('')}>&times;</button>
        </div>
      )}

      {tab === 'market' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-4">
            {selected && (
              <div className="card">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-xl font-bold">{selected.name}</h2>
                    <p className="text-sm text-white/40">{selected.symbol} · {selected.code}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-3xl font-bold font-mono">{selected.current_price?.toFixed(4)}</p>
                    <p className={`text-sm flex items-center justify-end gap-1 ${selected.change_percent >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {selected.change_percent >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                      {selected.change_percent >= 0 ? '+' : ''}{selected.change_percent}%
                    </p>
                  </div>
                </div>

                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={kline.slice(-60)}>
                      <defs>
                        <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="date" tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }} axisLine={false} tickLine={false} />
                      <YAxis domain={['auto', 'auto']} tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={{ background: 'rgba(30,27,75,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', color: '#fff' }} />
                      <Area type="monotone" dataKey="close" stroke="#6366f1" strokeWidth={2} fill="url(#colorPrice)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                <div className="mt-4 space-y-3">
                  <div className="flex gap-2">
                    <button onClick={() => setTradeForm({...tradeForm, action: 'buy'})}
                      className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all ${tradeForm.action === 'buy' ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'text-white/40 hover:text-white/60 border border-white/10'}`}>
                      买入
                    </button>
                    <button onClick={() => setTradeForm({...tradeForm, action: 'sell'})}
                      className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all ${tradeForm.action === 'sell' ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'text-white/40 hover:text-white/60 border border-white/10'}`}>
                      卖出
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <input type="number" min="1" className="input-field flex-1" placeholder="数量（份）"
                      value={tradeForm.amount} onChange={e => setTradeForm({...tradeForm, amount: e.target.value})} />
                    <button onClick={handleTrade} className={`px-6 rounded-xl font-medium transition-all ${tradeForm.action === 'buy' ? 'bg-green-500 hover:bg-green-600 text-white' : 'bg-red-500 hover:bg-red-600 text-white'}`}>
                      {tradeForm.action === 'buy' ? '买入' : '卖出'}
                    </button>
                  </div>
                  {tradeForm.amount && (
                    <p className="text-sm text-white/40 text-center">
                      预计{tradeForm.action === 'buy' ? '花费' : '获得'}：
                      <span className="text-amber-400 font-mono">{(selected.current_price * parseFloat(tradeForm.amount || 0)).toFixed(2)}</span> GMC
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-3">
            <h3 className="text-sm text-white/50 font-medium">交易标的</h3>
            {stocks.map(s => (
              <div key={s.symbol} onClick={() => setSelected(s)}
                className={`card cursor-pointer flex items-center justify-between py-3 ${selected?.symbol === s.symbol ? 'border-indigo-500/40' : ''}`}>
                <div>
                  <p className="font-medium text-sm">{s.name}</p>
                  <p className="text-xs text-white/40">{s.symbol}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full mt-1 inline-block ${
                    s.category === 'ai_stock' ? 'bg-purple-500/15 text-purple-400' :
                    s.category === 'futures' ? 'bg-amber-500/15 text-amber-400' :
                    s.category === 'crypto' ? 'bg-cyan-500/15 text-cyan-400' :
                    s.category === 'index' ? 'bg-blue-500/15 text-blue-400' :
                    'bg-green-500/15 text-green-400'
                  }`}>{s.category === 'ai_stock' ? 'AI概念' : s.category === 'futures' ? '期货' : s.category === 'crypto' ? '加密' : s.category === 'index' ? '指数' : '股票'}</span>
                </div>
                <div className="text-right">
                  <p className="font-mono text-sm">{s.current_price?.toFixed(2)}</p>
                  <p className={`text-xs ${s.change_percent >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {s.change_percent >= 0 ? '+' : ''}{s.change_percent}%
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'portfolio' && (
        <div className="space-y-4">
          <div className="card gradient-border">
            <p className="text-white/50 text-sm mb-1">可用余额</p>
            <p className="text-3xl font-bold gradient-text">{portfolio?.balance?.toLocaleString() || 0} GMC</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {portfolio?.positions?.map(p => (
              <div key={p.symbol} className="card">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="font-semibold">{p.name}</h3>
                    <p className="text-xs text-white/40">{p.symbol}</p>
                  </div>
                  <span className={`text-sm font-semibold ${p.profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {p.profit >= 0 ? '+' : ''}{p.profit?.toFixed(2)} ({p.profit_percent}%)
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><span className="text-white/40 text-xs">持仓量</span><p className="font-mono">{p.amount}</p></div>
                  <div><span className="text-white/40 text-xs">均价</span><p className="font-mono">{p.avg_cost}</p></div>
                  <div><span className="text-white/40 text-xs">现价</span><p className="font-mono">{p.current_price}</p></div>
                  <div><span className="text-white/40 text-xs">市值</span><p className="font-mono text-amber-400">{p.market_value}</p></div>
                </div>
              </div>
            ))}
            {(!portfolio?.positions || portfolio.positions.length === 0) && (
              <div className="card col-span-2 text-center text-white/40 py-8">暂无持仓</div>
            )}
          </div>
        </div>
      )}

      {tab === 'history' && (
        <div className="space-y-2">
          {history.map(t => (
            <div key={t.id} className="card flex items-center justify-between py-3">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${t.action === 'buy' ? 'bg-green-500/15 text-green-400' : 'bg-red-500/15 text-red-400'}`}>
                  {t.action === 'buy' ? <TrendingUp size={20} /> : <TrendingDown size={20} />}
                </div>
                <div>
                  <p className="text-sm font-medium">{t.action === 'buy' ? '买入' : '卖出'} {t.name}</p>
                  <p className="text-xs text-white/40">{new Date(t.created_at).toLocaleString('zh-CN')}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-mono text-sm">{t.amount}份 @ {t.price?.toFixed(4)}</p>
                <p className="text-xs text-amber-400 font-mono">{t.total?.toFixed(2)} GMC</p>
              </div>
            </div>
          ))}
          {history.length === 0 && <div className="card text-center text-white/40 py-8">暂无交易记录</div>}
        </div>
      )}
    </div>
  );
}
