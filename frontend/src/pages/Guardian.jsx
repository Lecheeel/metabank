import { useState, useEffect } from 'react';
import api from '../utils/api';
import { ShieldCheck, UserPlus, Users, Clock, CheckCircle, XCircle, Settings } from 'lucide-react';

export default function Guardian() {
  const [tab, setTab] = useState('my-guardians');
  const [guardians, setGuardians] = useState([]);
  const [wards, setWards] = useState([]);
  const [requests, setRequests] = useState([]);
  const [pendingApprovals, setPendingApprovals] = useState([]);
  const [myPending, setMyPending] = useState([]);
  const [dailyLimit, setDailyLimit] = useState(5000);
  const [bindUsername, setBindUsername] = useState('');
  const [bindRelation, setBindRelation] = useState('子女');
  const [limitInput, setLimitInput] = useState('');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const load = () => {
    api.get('/guardian/guardians').then(d => { setGuardians(d.guardians || []); setDailyLimit(d.daily_limit || 5000); }).catch(() => {});
    api.get('/guardian/wards').then(setWards).catch(() => {});
    api.get('/guardian/requests').then(setRequests).catch(() => {});
    api.get('/guardian/pending-approvals').then(setPendingApprovals).catch(() => {});
    api.get('/guardian/my-pending').then(setMyPending).catch(() => {});
  };

  useEffect(() => { load(); }, []);

  const sendBind = async () => {
    if (!bindUsername.trim()) return;
    setLoading(true);
    try {
      const r = await api.post('/guardian/bind', { target_username: bindUsername.trim(), relation: bindRelation });
      setMsg(r.message || '邀请已发送');
      setBindUsername('');
      load();
    } catch (e) { setMsg(e.detail || '发送失败'); }
    setLoading(false);
  };

  const handleRequest = async (id, action) => {
    try {
      const r = await api.post(`/guardian/requests/${id}/${action}`);
      setMsg(r.message || '操作成功');
      load();
    } catch (e) { setMsg(e.detail || '操作失败'); }
  };

  const handleApproval = async (id, decision) => {
    try {
      const r = await api.post(`/guardian/approve/${id}`, { decision });
      setMsg(r.message || (decision === 'approve' ? '已批准' : '已拒绝'));
      load();
    } catch (e) { setMsg(e.detail || '操作失败'); }
  };

  const saveLimit = async () => {
    const v = parseFloat(limitInput);
    if (isNaN(v) || v < 0) { setMsg('请输入有效金额'); return; }
    try {
      const r = await api.put('/guardian/daily-limit', { daily_limit: v });
      setMsg(r.message || '已更新');
      setDailyLimit(v);
      setLimitInput('');
    } catch (e) { setMsg(e.detail || '更新失败'); }
  };

  const TABS = [
    { key: 'my-guardians', label: '我的监护人', icon: ShieldCheck },
    { key: 'my-wards', label: '我监护的老人', icon: Users },
    { key: 'requests', label: `待处理邀请${requests.length ? ` (${requests.length})` : ''}`, icon: UserPlus },
    { key: 'approvals', label: `待审批交易${pendingApprovals.length ? ` (${pendingApprovals.length})` : ''}`, icon: Clock },
    { key: 'my-pending', label: `我的待审批${myPending.length ? ` (${myPending.length})` : ''}`, icon: Clock },
  ];

  return (
    <div className="senior-ui" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div className="flex items-center gap-3">
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-white" style={{ background: 'linear-gradient(135deg,#f97316,#ea580c)' }}>
          <ShieldCheck size={28} />
        </div>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 700, color: '#111827' }}>监护中心</h1>
          <p style={{ fontSize: '1.125rem', color: '#6b7280' }}>家人守护·大额二次确认</p>
        </div>
      </div>

      {msg && (
        <div className="rounded-xl flex justify-between" style={{ background: '#fff7ed', border: '1px solid #fed7aa', color: '#ea580c', padding: '1rem 1.25rem', fontSize: '1.125rem' }}>
          {msg}<button onClick={() => setMsg('')} className="ui-icon-button" aria-label="关闭提示">×</button>
        </div>
      )}

      <div className="ui-tab-group">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={tab === t.key ? 'ui-tab-button ui-tab-button-active' : 'ui-tab-button'}>
            <t.icon size={18} className="flex-shrink-0" />
            <span className="truncate" style={{ maxWidth: '9rem' }}>{t.label}</span>
          </button>
        ))}
      </div>

      {/* 我的监护人 */}
      {tab === 'my-guardians' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className="card">
            <h2 style={{ fontSize: '1.375rem', fontWeight: 700, marginBottom: '1rem' }}>邀请监护人</h2>
            <div className="flex flex-col sm:flex-row gap-3">
              <input className="input-field flex-1" style={{ fontSize: '1.125rem' }}
                placeholder="输入子女/家人的用户名" value={bindUsername} onChange={e => setBindUsername(e.target.value)} />
              <select className="input-field" style={{ width: '100%', maxWidth: '10rem', fontSize: '1.125rem' }}
                value={bindRelation} onChange={e => setBindRelation(e.target.value)}>
                {['子女', '配偶', '兄弟姐妹', '其他'].map(r => <option key={r}>{r}</option>)}
              </select>
              <button onClick={sendBind} disabled={loading || !bindUsername.trim()} className="btn-primary" style={{ whiteSpace: 'nowrap' }}>
                发送邀请
              </button>
            </div>
          </div>

          <div className="card">
            <div className="flex items-center justify-between" style={{ marginBottom: '1rem' }}>
              <h2 style={{ fontSize: '1.375rem', fontWeight: 700 }}>大额交易阈值</h2>
              <span style={{ fontSize: '1.125rem', color: '#ea580c', fontWeight: 700 }}>当前：{dailyLimit.toLocaleString()} GMC</span>
            </div>
            <p style={{ fontSize: '1rem', color: '#6b7280', marginBottom: '1rem' }}>超过此金额的交易将通知监护人审批（需已绑定监护人）</p>
            <div className="flex gap-3">
              <input className="input-field" type="number" style={{ flex: 1, fontSize: '1.125rem' }}
                placeholder="输入新阈值（GMC）" value={limitInput} onChange={e => setLimitInput(e.target.value)} />
              <button onClick={saveLimit} className="btn-primary" style={{ minWidth: '6rem' }}>
                <Settings size={18} />保存
              </button>
            </div>
          </div>

          {guardians.length > 0 && (
            <div className="card">
              <h2 style={{ fontSize: '1.375rem', fontWeight: 700, marginBottom: '1rem' }}>已绑定监护人</h2>
              {guardians.map((g, i) => (
                <div key={i} className="flex items-center justify-between py-3" style={{ borderBottom: i < guardians.length - 1 ? '1px solid #f3f4f6' : 'none' }}>
                  <div>
                    <p style={{ fontWeight: 600, fontSize: '1.125rem' }}>{g.nickname}</p>
                    <p style={{ color: '#6b7280', fontSize: '1rem' }}>关系：{g.relation}</p>
                  </div>
                  <span style={{ fontSize: '0.9375rem', color: '#16a34a', fontWeight: 600 }}>● 已绑定</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 我监护的老人 */}
      {tab === 'my-wards' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {wards.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', color: '#9ca3af', fontSize: '1.125rem', padding: '3rem' }}>暂无被监护人</div>
          ) : wards.map(w => (
            <div key={w.id} className="card">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate" style={{ fontWeight: 700, fontSize: '1.25rem' }}>{w.nickname}</p>
                  <p className="truncate" style={{ color: '#6b7280', fontSize: '1rem' }}>@{w.username}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p style={{ fontSize: '1.125rem', fontWeight: 700, color: '#ea580c' }}>{w.balance?.toLocaleString()} GMC</p>
                  <p style={{ fontSize: '0.9375rem', color: '#6b7280' }}>阈值：{w.daily_limit?.toLocaleString()}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 待处理邀请 */}
      {tab === 'requests' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {requests.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', color: '#9ca3af', fontSize: '1.125rem', padding: '3rem' }}>暂无待处理邀请</div>
          ) : requests.map(r => (
            <div key={r.id} className="card">
              <p style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '0.5rem' }}>
                <strong>{r.from_nickname}</strong> 邀请您成为其监护人（关系：{r.relation}）
              </p>
              <p style={{ fontSize: '0.9375rem', color: '#6b7280', marginBottom: '1rem' }}>{new Date(r.created_at).toLocaleString('zh-CN')}</p>
              <div className="flex gap-3">
                <button onClick={() => handleRequest(r.id, 'accept')} className="btn-primary" style={{ flex: 1 }}>
                  <CheckCircle size={18} />同意
                </button>
                <button onClick={() => handleRequest(r.id, 'reject')}
                  style={{ flex: 1, padding: '0.75rem', borderRadius: '0.75rem', background: '#fef2f2', color: '#ef4444', border: '1.5px solid #fecaca', cursor: 'pointer', fontSize: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                  <XCircle size={18} />拒绝
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 待审批交易（子女端） */}
      {tab === 'approvals' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {pendingApprovals.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', color: '#9ca3af', fontSize: '1.125rem', padding: '3rem' }}>暂无待审批交易</div>
          ) : pendingApprovals.map(a => (
            <div key={a.id} className="card" style={{ border: '2px solid #fed7aa' }}>
              <div className="flex items-center justify-between gap-3" style={{ marginBottom: '0.75rem' }}>
                <p className="truncate min-w-0 flex-1" style={{ fontWeight: 700, fontSize: '1.25rem', color: '#ea580c' }}>{a.nickname} 的大额交易申请</p>
                <span className="flex-shrink-0" style={{ fontSize: '1.125rem', fontWeight: 700 }}>{a.amount?.toLocaleString()} GMC</span>
              </div>
              <p style={{ fontSize: '1rem', color: '#6b7280', marginBottom: '0.5rem' }}>
                类型：{a.action_type === 'trade' ? '交易所买卖' : a.action_type === 'transfer' ? '转账' : '商城下单'}
              </p>
              <p style={{ fontSize: '0.9375rem', color: '#9ca3af', marginBottom: '1rem' }}>
                {new Date(a.created_at).toLocaleString('zh-CN')} · 有效至 {new Date(a.expires_at).toLocaleString('zh-CN')}
              </p>
              <div className="flex gap-3">
                <button onClick={() => handleApproval(a.id, 'approve')} className="btn-primary" style={{ flex: 1 }}>
                  <CheckCircle size={18} />批准
                </button>
                <button onClick={() => handleApproval(a.id, 'reject')}
                  style={{ flex: 1, padding: '0.75rem', borderRadius: '0.75rem', background: '#fef2f2', color: '#ef4444', border: '1.5px solid #fecaca', cursor: 'pointer', fontSize: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                  <XCircle size={18} />拒绝
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 我的待审批（老人端） */}
      {tab === 'my-pending' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {myPending.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', color: '#9ca3af', fontSize: '1.125rem', padding: '3rem' }}>暂无待审批记录</div>
          ) : myPending.map(a => (
            <div key={a.id} className="card">
              <div className="flex items-center justify-between" style={{ marginBottom: '0.5rem' }}>
                <p style={{ fontWeight: 600, fontSize: '1.125rem' }}>
                  {a.action_type === 'trade' ? '交易所买卖' : a.action_type === 'transfer' ? '转账' : '商城下单'}
                </p>
                <span style={{
                  padding: '0.25rem 0.75rem', borderRadius: '9999px', fontSize: '0.9375rem', fontWeight: 600,
                  background: a.status === 'pending' ? '#fff7ed' : a.status === 'approved' ? '#f0fdf4' : '#fef2f2',
                  color: a.status === 'pending' ? '#ea580c' : a.status === 'approved' ? '#16a34a' : '#ef4444',
                }}>
                  {a.status === 'pending' ? '等待审批' : a.status === 'approved' ? '已批准' : a.status === 'rejected' ? '已拒绝' : '已过期'}
                </span>
              </div>
              <p style={{ fontSize: '1.125rem', fontWeight: 700, color: '#ea580c' }}>{a.amount?.toLocaleString()} GMC</p>
              <p style={{ fontSize: '0.9375rem', color: '#9ca3af', marginTop: '0.25rem' }}>{new Date(a.created_at).toLocaleString('zh-CN')}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
