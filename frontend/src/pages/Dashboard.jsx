import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getUser } from '../utils/auth';
import api from '../utils/api';
import { Wallet, TrendingUp, ShoppingBag, MessageCircle, Bot, ArrowUpRight, ArrowDownRight, Activity } from 'lucide-react';

export default function Dashboard() {
  const user = getUser();
  const [walletInfo, setWalletInfo] = useState(null);
  const [stocks, setStocks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/wallet/info').catch(() => null),
      api.get('/exchange/stocks').catch(() => []),
    ]).then(([w, s]) => {
      setWalletInfo(w);
      setStocks(Array.isArray(s) ? s : []);
      setLoading(false);
    });
  }, []);

  const quickActions = [
    { icon: Wallet, label: '钱包', path: '/app/wallet', color: 'from-orange-500 to-amber-500' },
    { icon: ShoppingBag, label: '商城', path: '/app/shop', color: 'from-orange-400 to-red-400' },
    { icon: TrendingUp, label: '交易所', path: '/app/exchange', color: 'from-orange-400 to-amber-400' },
    { icon: MessageCircle, label: '社区', path: '/app/chat', color: 'from-green-500 to-emerald-500' },
    { icon: Bot, label: 'AI助手', path: '/app/ai', color: 'from-amber-500 to-orange-500' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
      <div>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '0.35rem', color: '#111827' }}>欢迎回来，{user?.nickname || '用户'}</h1>
        <p style={{ fontSize: '1rem', color: '#6b7280' }}>MetaBank 元宇宙金融养老社区</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3" style={{ gap: '2rem' }}>
        <div className="lg:col-span-2 card gradient-border">
          <div className="flex items-start justify-between" style={{ marginBottom: '1.25rem' }}>
            <div>
              <p style={{ fontSize: '1rem', color: '#6b7280', marginBottom: '0.35rem' }}>国脉币余额</p>
              <h2 className="font-bold gradient-text" style={{ fontSize: '2.5rem' }}>
                {loading ? '...' : (walletInfo?.balance?.toLocaleString() || '0')}
              </h2>
              <p style={{ fontSize: '1.0625rem', color: '#9ca3af', marginTop: '0.35rem' }}>GMC Token</p>
            </div>
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-100 to-amber-100 flex items-center justify-center">
              <Wallet size={32} className="text-orange-500" />
            </div>
          </div>
          <div className="bg-gray-50 rounded-xl" style={{ padding: '1.25rem', marginTop: '1.25rem' }}>
            <p style={{ fontSize: '1.0625rem', color: '#6b7280', marginBottom: '0.5rem' }}>钱包地址</p>
            <p className="font-mono text-orange-500 break-all" style={{ fontSize: '1rem' }}>{walletInfo?.wallet_address || user?.wallet_address || '...'}</p>
          </div>
        </div>

        <div className="card">
          <h3 style={{ fontSize: '1.125rem', color: '#6b7280', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Activity size={20} />
            市场概况
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {stocks.slice(0, 4).map(s => (
              <div key={s.symbol} className="flex items-center justify-between">
                <div>
                  <p style={{ fontSize: '1rem', fontWeight: 500 }}>{s.name}</p>
                  <p style={{ fontSize: '1.0625rem', color: '#6b7280' }}>{s.symbol}</p>
                </div>
                <div className="text-right">
                  <p className="font-mono" style={{ fontSize: '1rem' }}>{s.current_price?.toFixed(2)}</p>
                  <p className={`flex items-center gap-0.5 justify-end`} style={{ fontSize: '1.0625rem', color: s.change_percent >= 0 ? '#22c55e' : '#ef4444' }}>
                    {s.change_percent >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                    {Math.abs(s.change_percent)}%
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div>
        <h3 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '1.25rem', color: '#111827' }}>快捷操作</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5" style={{ gap: '1.25rem' }}>
          {quickActions.map(a => (
            <Link key={a.path} to={a.path} className="card text-center group hover:scale-105 transition-transform">
              <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${a.color} flex items-center justify-center mx-auto group-hover:scale-110 transition-transform`} style={{ marginBottom: '1rem' }}>
                <a.icon size={26} className="text-white" />
              </div>
              <p style={{ fontSize: '1rem', fontWeight: 500 }}>{a.label}</p>
            </Link>
          ))}
        </div>
      </div>

      {walletInfo?.transactions?.length > 0 && (
        <div>
          <div className="flex items-center justify-between" style={{ marginBottom: '1.25rem' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#111827' }}>最近交易</h3>
            <Link to="/app/wallet" style={{ fontSize: '1rem', color: '#f97316' }}>查看全部</Link>
          </div>
          <div className="card">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {walletInfo.transactions.slice(0, 5).map(t => (
                <div key={t.id} className="flex items-center justify-between last:border-b-0" style={{ padding: '1rem 0', borderBottom: '1px solid #f3f4f6' }}>
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      t.to_address === walletInfo.wallet_address ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                    }`}>
                      {t.to_address === walletInfo.wallet_address ? <ArrowDownRight size={20} /> : <ArrowUpRight size={20} />}
                    </div>
                    <div>
                      <p style={{ fontSize: '1rem', fontWeight: 500 }}>{t.note || t.type}</p>
                      <p style={{ fontSize: '1.0625rem', color: '#6b7280' }}>{new Date(t.created_at).toLocaleString('zh-CN')}</p>
                    </div>
                  </div>
                  <span className={`font-mono font-semibold ${t.to_address === walletInfo.wallet_address ? 'text-green-400' : 'text-red-400'}`} style={{ fontSize: '1.125rem' }}>
                    {t.to_address === walletInfo.wallet_address ? '+' : '-'}{t.amount?.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
