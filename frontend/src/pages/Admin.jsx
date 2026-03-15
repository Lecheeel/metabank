import { useState, useEffect } from 'react';
import api from '../utils/api';
import { Users, ShoppingBag, TrendingUp, Activity, Package, Coins, Plus, Settings, Eye, EyeOff, Key, Bot, Trash2 } from 'lucide-react';

export default function Admin() {
  const [dashboard, setDashboard] = useState(null);
  const [users, setUsers] = useState([]);
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [settings, setSettings] = useState(null);
  const [tab, setTab] = useState('overview');
  const [adjustUser, setAdjustUser] = useState(null);
  const [adjustAmount, setAdjustAmount] = useState('');
  const [newProduct, setNewProduct] = useState({ name: '', description: '', price: '', image: '', category: 'virtual', stock: '999' });
  const [msg, setMsg] = useState('');

  const [apiKeyInput, setApiKeyInput] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [modelInput, setModelInput] = useState('qwen3.5-flash');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [savingSettings, setSavingSettings] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    api.get('/admin/dashboard').then(setDashboard).catch(() => {});
    api.get('/admin/users').then(setUsers).catch(() => {});
    api.get('/admin/orders').then(setOrders).catch(() => {});
    api.get('/admin/products').then(setProducts).catch(() => {});
    api.get('/admin/settings').then(s => {
      setSettings(s);
      setModelInput(s.llm_model || 'qwen3.5-flash');
      setSystemPrompt(s.llm_system_prompt || '');
    }).catch(() => {});
  };

  const handleAdjustBalance = async () => {
    if (!adjustUser || !adjustAmount) return;
    try {
      await api.put(`/admin/user/${adjustUser.id}/balance?amount=${parseFloat(adjustAmount)}`);
      setMsg('余额调整成功');
      setAdjustUser(null);
      setAdjustAmount('');
      loadData();
    } catch (err) {
      setMsg(err.detail || '操作失败');
    }
  };

  const handleAddProduct = async () => {
    try {
      await api.post('/shop/products', { ...newProduct, price: parseFloat(newProduct.price), stock: parseInt(newProduct.stock) });
      setMsg('商品添加成功');
      setNewProduct({ name: '', description: '', price: '', image: '', category: 'virtual', stock: '999' });
      loadData();
    } catch (err) {
      setMsg(err.detail || '添加失败');
    }
  };

  const handleDeleteProduct = async (id) => {
    await api.delete(`/admin/product/${id}`);
    loadData();
  };

  const handleUpdateOrder = async (id, status) => {
    await api.put(`/admin/order/${id}/status?status=${status}`);
    loadData();
  };

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    try {
      const payload = {
        llm_model: modelInput,
        llm_system_prompt: systemPrompt,
      };
      if (apiKeyInput.trim()) {
        payload.dashscope_api_key = apiKeyInput.trim();
      }
      const res = await api.put('/admin/settings', payload);
      setMsg('设置已保存');
      setSettings(res.settings);
      setApiKeyInput('');
    } catch (err) {
      setMsg(err.detail || '保存失败');
    }
    setSavingSettings(false);
  };

  const handleClearApiKey = async () => {
    try {
      await api.delete('/admin/settings/api-key');
      setMsg('API Key 已清除');
      loadData();
    } catch (err) {
      setMsg(err.detail || '操作失败');
    }
  };

  const stats = dashboard ? [
    { label: '总用户', value: dashboard.total_users, icon: Users, color: 'from-orange-500 to-amber-500' },
    { label: '总订单', value: dashboard.total_orders, icon: Package, color: 'from-orange-400 to-red-400' },
    { label: '交易笔数', value: dashboard.total_transactions, icon: Activity, color: 'from-orange-400 to-amber-400' },
    { label: '总交易额', value: dashboard.total_tx_amount?.toLocaleString(), icon: Coins, color: 'from-amber-500 to-orange-500' },
  ] : [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
      <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: '#111827' }}>管理后台</h1>

      {msg && (
        <div className="px-4 py-3 rounded-xl flex justify-between" style={{ background: '#dcfce7', border: '1px solid #86efac', color: '#15803d', fontSize: '1rem' }}>
          {msg}<button onClick={() => setMsg('')}>&times;</button>
        </div>
      )}

      <div className="flex gap-2 flex-wrap">
        {[['overview', '概览'], ['users', '用户'], ['orders', '订单'], ['products', '商品'], ['settings', '系统设置']].map(([k, v]) => (
          <button key={k} onClick={() => setTab(k)} className="px-4 py-2 rounded-xl font-medium transition-all flex items-center gap-1.5" style={{ fontSize: '1rem', ...(tab === k ? { background: '#fff7ed', color: '#ea580c', border: '1px solid #fcd34d' } : { color: '#6b7280', border: '1px solid transparent' }) }}>
            {k === 'settings' && <Settings size={16} />}
            {v}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4" style={{ gap: '1.5rem' }}>
            {stats.map((s, i) => (
              <div key={i} className="card">
                <div className="flex items-center justify-between" style={{ marginBottom: '0.75rem' }}>
                  <span style={{ fontSize: '1rem', color: '#6b7280' }}>{s.label}</span>
                  <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${s.color} flex items-center justify-center`}>
                    <s.icon size={20} className="text-white" />
                  </div>
                </div>
                <p className="font-bold" style={{ fontSize: '1.75rem' }}>{s.value}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2" style={{ gap: '1.5rem' }}>
            <div className="card">
              <h3 className="font-semibold" style={{ fontSize: '1.125rem', marginBottom: '1rem' }}>最近订单</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {dashboard?.recent_orders?.slice(0, 5).map(o => (
                  <div key={o.id} className="flex items-center justify-between border-b border-gray-100 last:border-0" style={{ padding: '0.75rem 0', fontSize: '1rem' }}>
                    <div>
                      <p style={{ fontSize: '1rem' }}>{o.product_name}</p>
                      <p style={{ fontSize: '1.0625rem', color: '#6b7280' }}>@{o.username}</p>
                    </div>
                    <span className="text-amber-400 font-mono">{o.total_price} GMC</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="card">
              <h3 className="font-semibold" style={{ fontSize: '1.125rem', marginBottom: '1rem' }}>最近交易</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {dashboard?.recent_transactions?.slice(0, 5).map(t => (
                  <div key={t.id} className="flex items-center justify-between border-b border-gray-100 last:border-0" style={{ padding: '0.75rem 0', fontSize: '1rem' }}>
                    <div>
                      <p style={{ fontSize: '1rem' }}>{t.note?.slice(0, 30)}</p>
                      <p style={{ fontSize: '1.0625rem', color: '#6b7280' }}>{t.type}</p>
                    </div>
                    <span className="font-mono">{t.amount} GMC</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      {tab === 'users' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {users.map(u => (
            <div key={u.id} className="card flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-orange-400 to-amber-400 flex items-center justify-center font-bold" style={{ fontSize: '1.125rem' }}>
                  {(u.nickname || 'U')[0]}
                </div>
                <div>
                  <p className="font-medium" style={{ fontSize: '1rem' }}>{u.nickname} {u.is_admin && <span style={{ fontSize: '1.0625rem', color: '#f59e0b' }}>[管理员]</span>}</p>
                  <p style={{ fontSize: '1.0625rem', color: '#6b7280' }}>@{u.username} · {u.phone || '无手机号'}</p>
                  <p style={{ fontSize: '1rem', color: '#9ca3af' }} className="font-mono">{u.wallet_address}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <p className="font-mono text-amber-400" style={{ fontSize: '1.125rem' }}>{u.balance?.toLocaleString()} GMC</p>
                  <p style={{ fontSize: '1.0625rem', color: '#6b7280' }}>{new Date(u.created_at).toLocaleDateString('zh-CN')}</p>
                </div>
                <button onClick={() => setAdjustUser(u)} className="btn-secondary" style={{ fontSize: '1rem', padding: '0.5rem 1rem' }}>调整余额</button>
              </div>
            </div>
          ))}

          {adjustUser && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setAdjustUser(null)}>
              <div className="card w-full max-w-sm space-y-4" onClick={e => e.stopPropagation()}>
                <h3 className="font-semibold">调整余额 - {adjustUser.nickname}</h3>
                <p className="text-gray-500" style={{ fontSize: '1.0625rem' }}>当前余额: {adjustUser.balance?.toLocaleString()} GMC</p>
                <input type="number" className="input-field" placeholder="输入调整金额（正数增加，负数减少）"
                  value={adjustAmount} onChange={e => setAdjustAmount(e.target.value)} />
                <div className="flex gap-2">
                  <button onClick={handleAdjustBalance} className="btn-primary flex-1">确认</button>
                  <button onClick={() => setAdjustUser(null)} className="btn-secondary flex-1">取消</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'orders' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {orders.map(o => (
            <div key={o.id} className="card flex items-center justify-between">
              <div>
                <p className="font-medium" style={{ fontSize: '1rem' }}>{o.product_name} x{o.quantity}</p>
                <p style={{ fontSize: '1.0625rem', color: '#6b7280' }}>@{o.username} · {new Date(o.created_at).toLocaleString('zh-CN')}</p>
                {o.shipping_address && <p className="mt-1" style={{ fontSize: '1rem', color: '#9ca3af' }}>📍 {o.shipping_address} · {o.shipping_phone}</p>}
              </div>
              <div className="flex items-center gap-3">
                <span className="text-amber-400 font-mono" style={{ fontSize: '1.0625rem' }}>{o.total_price} GMC</span>
                <select value={o.status} onChange={e => handleUpdateOrder(o.id, e.target.value)}
                  className="input-field w-24">
                  <option value="pending_ship">待发货</option>
                  <option value="shipped">已发货</option>
                  <option value="completed">已完成</option>
                </select>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'products' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <h3 className="font-semibold flex items-center gap-2" style={{ fontSize: '1.125rem' }}><Plus size={18} />添加商品</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3" style={{ gap: '1rem' }}>
              <input className="input-field" placeholder="商品名称" value={newProduct.name}
                style={{ fontSize: '1rem' }}
                onChange={e => setNewProduct({...newProduct, name: e.target.value})} />
              <input className="input-field" placeholder="描述" value={newProduct.description}
                onChange={e => setNewProduct({...newProduct, description: e.target.value})} style={{ fontSize: '1rem' }} />
              <input type="number" className="input-field" placeholder="价格 (GMC)" value={newProduct.price}
                onChange={e => setNewProduct({...newProduct, price: e.target.value})} style={{ fontSize: '1rem' }} />
              <input className="input-field" placeholder="图标 (emoji)" value={newProduct.image}
                onChange={e => setNewProduct({...newProduct, image: e.target.value})} style={{ fontSize: '1rem' }} />
              <select className="input-field" value={newProduct.category}
                onChange={e => setNewProduct({...newProduct, category: e.target.value})} style={{ fontSize: '1rem' }}>
                <option value="virtual">虚拟商品</option>
                <option value="physical">实物商品</option>
              </select>
              <input type="number" className="input-field" placeholder="库存" value={newProduct.stock}
                onChange={e => setNewProduct({...newProduct, stock: e.target.value})} style={{ fontSize: '1rem' }} />
            </div>
            <button onClick={handleAddProduct} className="btn-primary" style={{ fontSize: '1rem', padding: '0.75rem 1.5rem' }}>添加商品</button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {products.map(p => (
              <div key={p.id} className="card flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span style={{ fontSize: '1.75rem' }}>{p.image || '📦'}</span>
                  <div>
                    <p className="font-medium" style={{ fontSize: '1rem' }}>{p.name}</p>
                    <p style={{ fontSize: '1.0625rem', color: '#6b7280' }}>{p.category === 'virtual' ? '虚拟' : '实物'} · 库存 {p.stock} · 已售 {p.sales || 0}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-amber-400 font-mono" style={{ fontSize: '1.125rem' }}>{p.price} GMC</span>
                  <button onClick={() => handleDeleteProduct(p.id)} className="text-red-400/50 hover:text-red-400" style={{ fontSize: '1rem' }}>删除</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'settings' && (
        <div className="space-y-6">
          <div className="card space-y-5">
            <div className="flex items-center gap-3 pb-4 border-b border-gray-200">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
                <Bot size={20} className="text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">AI 大模型配置</h3>
                <p style={{ fontSize: '1.0625rem', color: '#6b7280' }}>配置 DashScope API Key 以启用 Qwen 大模型智能服务</p>
              </div>
            </div>

            <div className="bg-gray-50 rounded-xl p-4 space-y-1">
              <div className="flex items-center justify-between">
                <span style={{ fontSize: '1.0625rem', color: '#6b7280' }}>当前状态</span>
                {settings?.has_api_key ? (
                  <span className="px-3 py-1.5 rounded-full bg-green-500/15 text-green-400 flex items-center gap-1.5" style={{ fontSize: '1rem' }}>
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                    Qwen 模型已启用
                  </span>
                ) : (
                  <span className="px-3 py-1.5 rounded-full bg-gray-100 text-gray-400 flex items-center gap-1.5" style={{ fontSize: '1rem' }}>
                    <span className="w-1.5 h-1.5 rounded-full bg-gray-300" />
                    本地模式
                  </span>
                )}
              </div>
              {settings?.has_api_key && settings?.dashscope_api_key_masked && (
                <p className="font-mono" style={{ fontSize: '1rem', color: '#6b7280' }}>已配置: {settings.dashscope_api_key_masked}</p>
              )}
            </div>

            <div>
              <label className="flex items-center gap-2 mb-2" style={{ fontSize: '1.0625rem', color: '#6b7280' }}>
                <Key size={14} />
                DashScope API Key
              </label>
              <p style={{ fontSize: '1rem', color: '#6b7280', marginBottom: '0.5rem' }}>
                请前往 <a href="https://dashscope.console.aliyun.com/" target="_blank" rel="noopener" className="text-orange-500 hover:text-orange-400 underline">阿里云 DashScope 控制台</a> 获取 API Key
              </p>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type={showApiKey ? 'text' : 'password'}
                    className="input-field pr-10 font-mono"
                    placeholder={settings?.has_api_key ? '输入新的 API Key 以替换...' : '输入 DashScope API Key (sk-...)'}
                    value={apiKeyInput}
                    onChange={e => setApiKeyInput(e.target.value)}
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-500"
                    onClick={() => setShowApiKey(!showApiKey)}
                  >
                    {showApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {settings?.has_api_key && (
                  <button onClick={handleClearApiKey} className="px-3 py-2 rounded-xl text-red-400/60 hover:text-red-400 hover:bg-red-500/10 transition-all" title="清除 API Key">
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            </div>

            <div>
              <label className="block mb-2" style={{ fontSize: '1.0625rem', color: '#6b7280' }}>模型选择</label>
              <select className="input-field" value={modelInput} onChange={e => setModelInput(e.target.value)}>
                <option value="qwen3.5-flash">Qwen 3.5 Flash（推荐，速度快）</option>
                <option value="qwen-plus">Qwen Plus（更强）</option>
                <option value="qwen-turbo">Qwen Turbo（最快）</option>
                <option value="qwen-max">Qwen Max（最强）</option>
              </select>
            </div>

            <div>
              <label className="block mb-2" style={{ fontSize: '1.0625rem', color: '#6b7280' }}>自定义系统提示词（可选）</label>
              <textarea
                className="input-field min-h-[80px] resize-y"
                placeholder="添加额外的 AI 行为指令...例如：请在每次回复末尾推荐一款商城产品"
                value={systemPrompt}
                onChange={e => setSystemPrompt(e.target.value)}
                rows={3}
              />
            </div>

            <button
              onClick={handleSaveSettings}
              disabled={savingSettings}
              className="btn-primary w-full py-3 flex items-center justify-center gap-2"
            >
              <Settings size={16} />
              {savingSettings ? '保存中...' : '保存设置'}
            </button>
          </div>

          <div className="card space-y-3">
            <h3 className="font-semibold">使用说明</h3>
            <div className="space-y-2" style={{ fontSize: '1.0625rem', color: '#6b7280' }}>
              <p>1. 在 <a href="https://dashscope.console.aliyun.com/" target="_blank" rel="noopener" className="text-orange-500 hover:text-orange-400">阿里云 DashScope</a> 注册并获取 API Key</p>
              <p>2. 将 API Key 填入上方输入框并保存</p>
              <p>3. 保存后，AI 助手将使用 Qwen 大模型进行智能对话</p>
              <p>4. 未配置 API Key 时，系统自动使用本地模式回复</p>
              <p>5. 用户也可在 AI 助手页面自行配置个人 API Key</p>
            </div>
          </div>

          <div className="card">
            <h3 className="font-semibold mb-3">管理员账号信息</h3>
            <div className="space-y-2" style={{ fontSize: '1.0625rem' }}>
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-500">用户名</span>
                <span className="font-mono">admin</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-500">密码</span>
                <span className="font-mono">admin123</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-gray-500">权限</span>
                <span className="text-amber-400">超级管理员</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
