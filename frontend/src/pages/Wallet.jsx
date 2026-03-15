import { useState, useEffect } from 'react';
import api from '../utils/api';
import { Send, Copy, Search, ArrowUpRight, ArrowDownRight, CheckCircle } from 'lucide-react';

export default function Wallet() {
  const [walletInfo, setWalletInfo] = useState(null);
  const [showTransfer, setShowTransfer] = useState(false);
  const [transferForm, setTransferForm] = useState({ to_address: '', amount: '', note: '' });
  const [lookupAddr, setLookupAddr] = useState('');
  const [lookupResult, setLookupResult] = useState(null);
  const [msg, setMsg] = useState('');
  const [copied, setCopied] = useState(false);

  const load = () => api.get('/wallet/info').then(setWalletInfo);
  useEffect(() => { load(); }, []);

  const handleTransfer = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post('/wallet/transfer', {
        ...transferForm,
        amount: parseFloat(transferForm.amount)
      });
      setMsg(res.message);
      setShowTransfer(false);
      setTransferForm({ to_address: '', amount: '', note: '' });
      load();
    } catch (err) {
      setMsg(err.detail || '转账失败');
    }
  };

  const handleLookup = async () => {
    try {
      const res = await api.get(`/wallet/lookup/${lookupAddr}`);
      setLookupResult(res);
    } catch {
      setLookupResult(null);
      setMsg('地址未找到');
    }
  };

  const copyAddress = () => {
    navigator.clipboard.writeText(walletInfo?.wallet_address || '');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!walletInfo) return <div className="flex items-center justify-center h-64"><div className="text-white/50">加载中...</div></div>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">我的钱包</h1>

      {msg && (
        <div className="bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 px-4 py-3 rounded-xl text-sm flex items-center justify-between">
          {msg}
          <button onClick={() => setMsg('')} className="text-white/50 hover:text-white">&times;</button>
        </div>
      )}

      <div className="card gradient-border">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <p className="text-white/50 text-sm mb-1">国脉币余额</p>
            <h2 className="text-5xl font-bold gradient-text">{walletInfo.balance?.toLocaleString()}</h2>
            <p className="text-white/30 text-sm mt-1">GMC Token</p>
          </div>
          <button onClick={() => setShowTransfer(!showTransfer)} className="btn-primary flex items-center gap-2">
            <Send size={16} />
            转账
          </button>
        </div>
        <div className="mt-4 bg-white/5 rounded-xl p-4">
          <p className="text-xs text-white/40 mb-2">钱包地址</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-sm text-cyan-400 font-mono break-all">{walletInfo.wallet_address}</code>
            <button onClick={copyAddress} className="text-white/40 hover:text-white p-2 rounded-lg hover:bg-white/10 transition-all">
              {copied ? <CheckCircle size={18} className="text-green-400" /> : <Copy size={18} />}
            </button>
          </div>
        </div>
      </div>

      {showTransfer && (
        <form onSubmit={handleTransfer} className="card space-y-4">
          <h3 className="text-lg font-semibold">转账</h3>
          <div>
            <label className="block text-sm text-white/60 mb-2">接收方钱包地址</label>
            <input className="input-field font-mono" placeholder="0xGM..." value={transferForm.to_address}
              onChange={e => setTransferForm({...transferForm, to_address: e.target.value})} required />
          </div>
          <div>
            <label className="block text-sm text-white/60 mb-2">金额 (GMC)</label>
            <input type="number" step="0.01" min="0.01" className="input-field" placeholder="输入转账金额"
              value={transferForm.amount} onChange={e => setTransferForm({...transferForm, amount: e.target.value})} required />
          </div>
          <div>
            <label className="block text-sm text-white/60 mb-2">备注</label>
            <input className="input-field" placeholder="选填" value={transferForm.note}
              onChange={e => setTransferForm({...transferForm, note: e.target.value})} />
          </div>
          <div className="flex gap-3">
            <button type="submit" className="btn-primary">确认转账</button>
            <button type="button" onClick={() => setShowTransfer(false)} className="btn-secondary">取消</button>
          </div>
        </form>
      )}

      <div className="card">
        <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <Search size={18} />
          地址查询
        </h3>
        <div className="flex gap-2">
          <input className="input-field font-mono flex-1" placeholder="输入钱包地址查询..."
            value={lookupAddr} onChange={e => setLookupAddr(e.target.value)} />
          <button onClick={handleLookup} className="btn-primary">查询</button>
        </div>
        {lookupResult && (
          <div className="mt-3 bg-white/5 rounded-xl p-3 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">{lookupResult.nickname}</p>
              <p className="text-xs text-white/40">@{lookupResult.username}</p>
            </div>
            <button onClick={() => { setTransferForm({...transferForm, to_address: lookupResult.wallet_address}); setShowTransfer(true); }}
              className="text-sm text-indigo-400 hover:text-indigo-300">转账给TA</button>
          </div>
        )}
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-3">交易记录</h3>
        <div className="space-y-2">
          {walletInfo.transactions?.map(t => (
            <div key={t.id} className="card flex items-center justify-between py-3">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  t.to_address === walletInfo.wallet_address ? 'bg-green-500/15 text-green-400' : 'bg-red-500/15 text-red-400'
                }`}>
                  {t.to_address === walletInfo.wallet_address ? <ArrowDownRight size={20} /> : <ArrowUpRight size={20} />}
                </div>
                <div>
                  <p className="text-sm font-medium">{t.note || (t.type === 'transfer' ? '转账' : t.type)}</p>
                  <p className="text-xs text-white/40">{new Date(t.created_at).toLocaleString('zh-CN')}</p>
                  <p className="text-xs text-white/30 font-mono mt-0.5">
                    {t.to_address === walletInfo.wallet_address ? `来自: ${t.from_address?.slice(0, 16)}...` : `发至: ${t.to_address?.slice(0, 16)}...`}
                  </p>
                </div>
              </div>
              <span className={`font-mono text-lg font-semibold ${t.to_address === walletInfo.wallet_address ? 'text-green-400' : 'text-red-400'}`}>
                {t.to_address === walletInfo.wallet_address ? '+' : '-'}{t.amount?.toLocaleString()}
              </span>
            </div>
          ))}
          {(!walletInfo.transactions || walletInfo.transactions.length === 0) && (
            <div className="card text-center text-white/40 py-8">暂无交易记录</div>
          )}
        </div>
      </div>
    </div>
  );
}
