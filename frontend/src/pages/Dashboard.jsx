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
    { icon: Wallet, label: '钱包', path: '/app/wallet', color: 'from-indigo-500 to-purple-500' },
    { icon: ShoppingBag, label: '商城', path: '/app/shop', color: 'from-pink-500 to-rose-500' },
    { icon: TrendingUp, label: '交易所', path: '/app/exchange', color: 'from-cyan-500 to-blue-500' },
    { icon: MessageCircle, label: '社区', path: '/app/chat', color: 'from-green-500 to-emerald-500' },
    { icon: Bot, label: 'AI助手', path: '/app/ai', color: 'from-amber-500 to-orange-500' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold mb-1">欢迎回来，{user?.nickname || '用户'}</h1>
        <p className="text-white/50 text-sm">MetaBank 元宇宙金融养老社区</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 card gradient-border">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-white/50 text-sm mb-1">国脉币余额</p>
              <h2 className="text-4xl font-bold gradient-text">
                {loading ? '...' : (walletInfo?.balance?.toLocaleString() || '0')}
              </h2>
              <p className="text-white/40 text-xs mt-1">GMC Token</p>
            </div>
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center">
              <Wallet size={28} className="text-indigo-400" />
            </div>
          </div>
          <div className="bg-white/5 rounded-xl p-3 mt-3">
            <p className="text-xs text-white/40 mb-1">钱包地址</p>
            <p className="text-sm font-mono text-cyan-400 break-all">{walletInfo?.wallet_address || user?.wallet_address || '...'}</p>
          </div>
        </div>

        <div className="card">
          <h3 className="text-sm text-white/50 mb-3 flex items-center gap-2">
            <Activity size={16} />
            市场概况
          </h3>
          <div className="space-y-3">
            {stocks.slice(0, 4).map(s => (
              <div key={s.symbol} className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{s.name}</p>
                  <p className="text-xs text-white/40">{s.symbol}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-mono">{s.current_price?.toFixed(2)}</p>
                  <p className={`text-xs flex items-center gap-0.5 ${s.change_percent >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {s.change_percent >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                    {Math.abs(s.change_percent)}%
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-3">快捷操作</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {quickActions.map(a => (
            <Link key={a.path} to={a.path} className="card text-center group hover:scale-105 transition-transform">
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${a.color} flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform`}>
                <a.icon size={22} className="text-white" />
              </div>
              <p className="text-sm font-medium">{a.label}</p>
            </Link>
          ))}
        </div>
      </div>

      {walletInfo?.transactions?.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold">最近交易</h3>
            <Link to="/app/wallet" className="text-sm text-indigo-400 hover:text-indigo-300">查看全部</Link>
          </div>
          <div className="card">
            <div className="space-y-3">
              {walletInfo.transactions.slice(0, 5).map(t => (
                <div key={t.id} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                      t.to_address === walletInfo.wallet_address ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                    }`}>
                      {t.to_address === walletInfo.wallet_address ? <ArrowDownRight size={16} /> : <ArrowUpRight size={16} />}
                    </div>
                    <div>
                      <p className="text-sm">{t.note || t.type}</p>
                      <p className="text-xs text-white/40">{new Date(t.created_at).toLocaleString('zh-CN')}</p>
                    </div>
                  </div>
                  <span className={`font-mono text-sm ${t.to_address === walletInfo.wallet_address ? 'text-green-400' : 'text-red-400'}`}>
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
