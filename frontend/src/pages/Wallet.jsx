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

  if (!walletInfo) return <div className="flex items-center justify-center h-64"><div className="text-gray-500">加载中...</div></div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
      <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: '#111827' }}>我的钱包</h1>

      {msg && (
        <div className="rounded-xl flex items-center justify-between" style={{ background: '#fff7ed', border: '1px solid #fed7aa', color: '#ea580c', padding: '1rem 1.25rem', fontSize: '1rem' }}>
          {msg}
          <button onClick={() => setMsg('')} style={{ color: '#6b7280' }}>&times;</button>
        </div>
      )}

      <div className="card gradient-border">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between" style={{ gap: '1.5rem' }}>
          <div>
            <p style={{ fontSize: '1rem', color: '#6b7280', marginBottom: '0.35rem' }}>国脉币余额</p>
            <h2 className="font-bold gradient-text" style={{ fontSize: '3rem' }}>{walletInfo.balance?.toLocaleString()}</h2>
            <p style={{ fontSize: '1rem', color: '#6b7280', marginTop: '0.35rem' }}>GMC Token</p>
          </div>
          <button onClick={() => setShowTransfer(!showTransfer)} className="btn-primary flex items-center gap-2" style={{ fontSize: '1rem', padding: '0.75rem 1.5rem' }}>
            <Send size={18} />
            转账
          </button>
        </div>
        <div className="bg-gray-50 rounded-xl" style={{ marginTop: '1.5rem', padding: '1.25rem' }}>
          <p style={{ fontSize: '1.0625rem', color: '#6b7280', marginBottom: '0.5rem' }}>钱包地址</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 font-mono text-orange-500 break-all" style={{ fontSize: '1rem' }}>{walletInfo.wallet_address}</code>
            <button onClick={copyAddress} className="p-2 rounded-lg hover:bg-gray-100 transition-all" style={{ color: '#6b7280' }}>
              {copied ? <CheckCircle size={20} className="text-green-400" /> : <Copy size={20} />}
            </button>
          </div>
        </div>
      </div>

      {showTransfer && (
        <form onSubmit={handleTransfer} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 600 }}>转账</h3>
          <div>
            <label className="block" style={{ fontSize: '1rem', color: '#6b7280', marginBottom: '0.5rem' }}>接收方钱包地址</label>
            <input className="input-field font-mono" placeholder="0xGM..." value={transferForm.to_address}
              onChange={e => setTransferForm({...transferForm, to_address: e.target.value})} required />
          </div>
          <div>
            <label className="block" style={{ fontSize: '1rem', color: '#6b7280', marginBottom: '0.5rem' }}>金额 (GMC)</label>
            <input type="number" step="0.01" min="0.01" className="input-field" placeholder="输入转账金额"
              value={transferForm.amount} onChange={e => setTransferForm({...transferForm, amount: e.target.value})} required />
          </div>
          <div>
            <label className="block" style={{ fontSize: '1rem', color: '#6b7280', marginBottom: '0.5rem' }}>备注</label>
            <input className="input-field" placeholder="选填" value={transferForm.note}
              onChange={e => setTransferForm({...transferForm, note: e.target.value})} />
          </div>
          <div className="flex" style={{ gap: '1rem' }}>
            <button type="submit" className="btn-primary" style={{ fontSize: '1rem' }}>确认转账</button>
            <button type="button" onClick={() => setShowTransfer(false)} className="btn-secondary" style={{ fontSize: '1rem' }}>取消</button>
          </div>
        </form>
      )}

      <div className="card">
        <h3 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Search size={20} />
          地址查询
        </h3>
        <div className="flex" style={{ gap: '0.75rem' }}>
          <input className="input-field font-mono flex-1" placeholder="输入钱包地址查询..."
            value={lookupAddr} onChange={e => setLookupAddr(e.target.value)} />
          <button onClick={handleLookup} className="btn-primary">查询</button>
        </div>
        {lookupResult && (
          <div className="mt-4 bg-gray-50 rounded-xl flex items-center justify-between" style={{ padding: '1.25rem' }}>
            <div>
              <p style={{ fontSize: '1rem', fontWeight: 500 }}>{lookupResult.nickname}</p>
              <p style={{ fontSize: '1.0625rem', color: '#6b7280' }}>@{lookupResult.username}</p>
            </div>
            <button onClick={() => { setTransferForm({...transferForm, to_address: lookupResult.wallet_address}); setShowTransfer(true); }}
              style={{ fontSize: '1rem', color: '#f97316' }}>转账给TA</button>
          </div>
        )}
      </div>

      <div>
        <h3 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '1.25rem' }}>交易记录</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {walletInfo.transactions?.map(t => (
            <div key={t.id} className="card flex items-center justify-between" style={{ padding: '1.25rem' }}>
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                  t.to_address === walletInfo.wallet_address ? 'bg-green-500/15 text-green-400' : 'bg-red-500/15 text-red-400'
                }`}>
                  {t.to_address === walletInfo.wallet_address ? <ArrowDownRight size={24} /> : <ArrowUpRight size={24} />}
                </div>
                <div>
                  <p style={{ fontSize: '1rem', fontWeight: 500 }}>{t.note || (t.type === 'transfer' ? '转账' : t.type)}</p>
                  <p style={{ fontSize: '1.0625rem', color: '#6b7280' }}>{new Date(t.created_at).toLocaleString('zh-CN')}</p>
                  <p className="font-mono" style={{ fontSize: '1.0625rem', color: '#6b7280', marginTop: '0.25rem' }}>
                    {t.to_address === walletInfo.wallet_address ? `来自: ${t.from_address?.slice(0, 16)}...` : `发至: ${t.to_address?.slice(0, 16)}...`}
                  </p>
                </div>
              </div>
              <span className={`font-mono font-semibold ${t.to_address === walletInfo.wallet_address ? 'text-green-400' : 'text-red-400'}`} style={{ fontSize: '1.25rem' }}>
                {t.to_address === walletInfo.wallet_address ? '+' : '-'}{t.amount?.toLocaleString()}
              </span>
            </div>
          ))}
          {(!walletInfo.transactions || walletInfo.transactions.length === 0) && (
            <div className="card text-center" style={{ color: '#6b7280', padding: '3rem', fontSize: '1rem' }}>暂无交易记录</div>
          )}
        </div>
      </div>
    </div>
  );
}
