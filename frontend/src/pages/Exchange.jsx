import { useState, useEffect, useRef } from 'react';
import api from '../utils/api';
import { TrendingUp, TrendingDown, BarChart3, Briefcase, History, ArrowUpRight, ArrowDownRight, Activity, Minus } from 'lucide-react';
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
  const [macro, setMacro] = useState(null);
  const [macroMode, setMacroMode] = useState('connecting'); // connecting | ws | http
  const prevMacroRef = useRef(null);

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

  // 宏观因子 WebSocket 实时推送，失败降级为 60s HTTP 轮询
  useEffect(() => {
    let ws = null;
    let fallbackTimer = null;
    const startHttpFallback = () => {
      setMacroMode('http');
      const fetchMacro = () => api.get('/exchange/macro').then(setMacro).catch(() => {});
      fetchMacro();
      fallbackTimer = setInterval(fetchMacro, 60000);
    };
    try {
      const proto = location.protocol === 'https:' ? 'wss' : 'ws';
      ws = new WebSocket(`${proto}://${location.host}/api/exchange/ws/macro`);
      ws.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          setMacro(prev => { prevMacroRef.current = prev; return data; });
          setMacroMode('ws');
        } catch { /* ignore */ }
      };
      ws.onerror = () => { try { ws && ws.close(); } catch {} startHttpFallback(); };
      ws.onclose = () => { if (macroMode !== 'http') startHttpFallback(); };
    } catch {
      startHttpFallback();
    }
    return () => {
      if (ws) try { ws.close(); } catch {}
      if (fallbackTimer) clearInterval(fallbackTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleTrade = async () => {
    if (!selected || !tradeForm.amount) return;
    try {
      const res = await api.post('/exchange/trade', {
        symbol: selected.symbol,
        action: tradeForm.action,
        amount: parseFloat(tradeForm.amount),
        price: selected.current_price
      });
      if (res.status === 'pending_approval') {
        setMsg(`⏳ ${res.message}`);
      } else {
        setMsg(res.message);
      }
      setTradeForm({ ...tradeForm, amount: '' });
      api.get('/exchange/portfolio').then(setPortfolio);
      api.get('/exchange/history').then(setHistory);
      api.get('/exchange/stocks').then(setStocks);
    } catch (err) {
      setMsg(err.detail || '交易失败');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
      <div className="flex items-center justify-between flex-wrap" style={{ gap: '0.75rem' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: '#111827' }}>交易所</h1>
        <div className="ui-tab-group">
          {[['market', '行情', BarChart3], ['portfolio', '持仓', Briefcase], ['history', '历史', History]].map(([k, v, Icon]) => (
            <button key={k} onClick={() => setTab(k)} className={tab === k ? 'ui-tab-button ui-tab-button-active' : 'ui-tab-button'}>
              <Icon size={18} />{v}
            </button>
          ))}
        </div>
      </div>

      {msg && (
        <div className="rounded-xl flex justify-between" style={{ background: '#fff7ed', border: '1px solid #fed7aa', color: '#ea580c', padding: '1rem 1.25rem', fontSize: '1rem' }}>
          {msg}<button onClick={() => setMsg('')} className="ui-icon-button" aria-label="关闭提示">&times;</button>
        </div>
      )}

      {tab === 'market' && (
        <div className="grid grid-cols-1 lg:grid-cols-3" style={{ gap: '2rem' }}>
          <div className="lg:col-span-2" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {selected && (
              <div className="card">
                <div className="flex items-center justify-between" style={{ marginBottom: '1.5rem' }}>
                  <div>
                    <h2 style={{ fontSize: '1.375rem', fontWeight: 700 }}>{selected.name}</h2>
                    <p style={{ fontSize: '1rem', color: '#6b7280' }}>{selected.symbol} · {selected.code}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono font-bold" style={{ fontSize: '2rem' }}>{selected.current_price?.toFixed(4)}</p>
                    <p className={`flex items-center justify-end gap-1 ${selected.change_percent >= 0 ? 'text-green-400' : 'text-red-400'}`} style={{ fontSize: '1rem' }}>
                      {selected.change_percent >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                      {selected.change_percent >= 0 ? '+' : ''}{selected.change_percent}%
                    </p>
                  </div>
                </div>

                <div style={{ height: '18rem' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={kline.slice(-60)}>
                      <defs>
                        <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#f97316" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="date" tick={{ fill: '#9ca3af', fontSize: 12 }} axisLine={false} tickLine={false} />
                      <YAxis domain={['auto', 'auto']} tick={{ fill: '#9ca3af', fontSize: 12 }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={{ background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '12px', color: '#111827', boxShadow: '0 4px 16px rgba(0,0,0,0.08)' }} />
                      <Area type="monotone" dataKey="close" stroke="#f97316" strokeWidth={2} fill="url(#colorPrice)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                <div className="mt-4 space-y-3">
                  <div className="flex gap-2">
                    <button onClick={() => setTradeForm({...tradeForm, action: 'buy'})}
                      className={`flex-1 min-h-12 px-4 rounded-2xl font-semibold transition-all ${tradeForm.action === 'buy' ? 'bg-green-500/20 text-green-500 border border-green-500/30' : 'bg-white text-gray-500 hover:text-gray-700 border border-gray-200'}`}>
                      买入
                    </button>
                    <button onClick={() => setTradeForm({...tradeForm, action: 'sell'})}
                      className={`flex-1 min-h-12 px-4 rounded-2xl font-semibold transition-all ${tradeForm.action === 'sell' ? 'bg-red-500/20 text-red-500 border border-red-500/30' : 'bg-white text-gray-500 hover:text-gray-700 border border-gray-200'}`}>
                      卖出
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <input type="number" min="1" className="input-field flex-1" placeholder="数量（份）"
                      value={tradeForm.amount} onChange={e => setTradeForm({...tradeForm, amount: e.target.value})} />
                    <button onClick={handleTrade} className={`min-h-12 px-6 rounded-2xl font-semibold transition-all ${tradeForm.action === 'buy' ? 'bg-green-500 hover:bg-green-600 text-white' : 'bg-red-500 hover:bg-red-600 text-white'}`}>
                      {tradeForm.action === 'buy' ? '买入' : '卖出'}
                    </button>
                  </div>
                  {tradeForm.amount && (
                    <p className="text-base text-gray-400 text-center">
                      预计{tradeForm.action === 'buy' ? '花费' : '获得'}：
                      <span className="text-amber-400 font-mono">{(selected.current_price * parseFloat(tradeForm.amount || 0)).toFixed(2)}</span> GMC
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-3">
            <div className="card" style={{ background: 'linear-gradient(135deg, #fff7ed 0%, #fffbeb 100%)', border: '1px solid #fed7aa' }}>
              <div className="flex items-center justify-between" style={{ marginBottom: '0.75rem' }}>
                <h3 className="font-semibold flex items-center gap-1.5" style={{ fontSize: '1rem', color: '#9a3412' }}>
                  <Activity size={16} />市场宏观面板
                </h3>
                <span className="flex items-center gap-1" style={{ fontSize: '0.75rem', color: macroMode === 'ws' ? '#16a34a' : macroMode === 'http' ? '#ea580c' : '#9ca3af' }}>
                  <span style={{
                    width: 6, height: 6, borderRadius: '50%',
                    background: macroMode === 'ws' ? '#16a34a' : macroMode === 'http' ? '#ea580c' : '#9ca3af',
                    animation: macroMode === 'ws' ? 'pulse 1.5s infinite' : 'none'
                  }} />
                  {macroMode === 'ws' ? '实时' : macroMode === 'http' ? '轮询' : '连接中'}
                </span>
              </div>
              {macro ? (
                <div className="space-y-2">
                  {[
                    { key: 'cpi', label: '通胀指数 CPI', value: macro.cpi, unit: '%', thresh: 0.02 },
                    { key: 'ai_heat', label: 'AI 热度', value: macro.ai_heat, unit: '/100', thresh: 1 },
                    { key: 'gold_premium', label: '黄金溢价', value: macro.gold_premium, unit: '%', thresh: 0.05, signed: true },
                    { key: 'sentiment', label: '市场情绪', value: macro.sentiment, unit: '', thresh: 0.02, signed: true },
                  ].map(m => {
                    const prev = prevMacroRef.current && prevMacroRef.current[m.key];
                    const diff = prev !== undefined && prev !== null ? (m.value - prev) : 0;
                    const arrow = Math.abs(diff) < m.thresh ? 'flat' : (diff > 0 ? 'up' : 'down');
                    return (
                      <div key={m.key} className="flex items-center justify-between" style={{ fontSize: '0.875rem', gap: '0.5rem' }}>
                        <span className="flex-shrink-0" style={{ color: '#6b7280' }}>{m.label}</span>
                        <span className="flex items-center gap-1 font-mono text-right" style={{ color: '#111827' }}>
                          {m.signed && m.value >= 0 ? '+' : ''}{typeof m.value === 'number' ? m.value.toFixed(m.key === 'ai_heat' ? 1 : 2) : '-'}{m.unit}
                          {arrow === 'up' && <TrendingUp size={14} className="text-green-500" />}
                          {arrow === 'down' && <TrendingDown size={14} className="text-red-500" />}
                          {arrow === 'flat' && <Minus size={14} className="text-gray-400" />}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-gray-400" style={{ fontSize: '0.875rem' }}>加载中...</p>
              )}
            </div>

            <h3 className="text-base text-gray-500 font-medium">交易标的</h3>
            {stocks.map(s => (
              <div key={s.symbol} onClick={() => setSelected(s)}
                className={`card cursor-pointer flex items-center justify-between py-3 ${selected?.symbol === s.symbol ? 'border-orange-300' : ''}`}>
                <div className="min-w-0 flex-1 mr-2">
                  <p className="font-medium text-base truncate">{s.name}</p>
                  <p className="text-base text-gray-400 truncate">{s.symbol}</p>
                  <span className={`text-base px-2 py-0.5 rounded-full mt-1 inline-block ${
                    s.category === 'ai_stock' ? 'bg-orange-50 text-orange-500' :
                    s.category === 'futures' ? 'bg-amber-500/15 text-amber-400' :
                    s.category === 'crypto' ? 'bg-orange-50 text-orange-500' :
                    s.category === 'index' ? 'bg-sky-50 text-sky-600' :
                    'bg-green-500/15 text-green-400'
                  }`}>{s.category === 'ai_stock' ? 'AI概念' : s.category === 'futures' ? '期货' : s.category === 'crypto' ? '加密' : s.category === 'index' ? '指数' : '股票'}</span>
                </div>
                <div className="text-right">
                  <p className="font-mono text-base">{s.current_price?.toFixed(2)}</p>
                  <p className={`text-base ${s.change_percent >= 0 ? 'text-green-400' : 'text-red-400'}`}>
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
            <p className="text-gray-500 text-base mb-1">可用余额</p>
            <p className="text-3xl font-bold gradient-text">{portfolio?.balance?.toLocaleString() || 0} GMC</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {portfolio?.positions?.map(p => (
              <div key={p.symbol} className="card">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="font-semibold">{p.name}</h3>
                    <p className="text-base text-gray-400">{p.symbol}</p>
                  </div>
                  <span className={`text-base font-semibold ${p.profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {p.profit >= 0 ? '+' : ''}{p.profit?.toFixed(2)} ({p.profit_percent}%)
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3 text-base">
                  <div><span className="text-gray-400 text-base">持仓量</span><p className="font-mono">{p.amount}</p></div>
                  <div><span className="text-gray-400 text-base">均价</span><p className="font-mono">{p.avg_cost}</p></div>
                  <div><span className="text-gray-400 text-base">现价</span><p className="font-mono">{p.current_price}</p></div>
                  <div><span className="text-gray-400 text-base">市值</span><p className="font-mono text-amber-400">{p.market_value}</p></div>
                </div>
              </div>
            ))}
            {(!portfolio?.positions || portfolio.positions.length === 0) && (
              <div className="card col-span-2 text-center text-gray-400 py-8">暂无持仓</div>
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
                  <p className="font-medium">{t.action === 'buy' ? '买入' : '卖出'} {t.name}</p>
                  <p className="text-base text-gray-400">{new Date(t.created_at).toLocaleString('zh-CN')}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-mono text-base">{t.amount}份 @ {t.price?.toFixed(4)}</p>
                <p className="text-base text-amber-400 font-mono">{t.total?.toFixed(2)} GMC</p>
              </div>
            </div>
          ))}
          {history.length === 0 && <div className="card text-center text-gray-400 py-8">暂无交易记录</div>}
        </div>
      )}
    </div>
  );
}
