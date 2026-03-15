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
    { label: '总用户', value: dashboard.total_users, icon: Users, color: 'from-indigo-500 to-purple-500' },
    { label: '总订单', value: dashboard.total_orders, icon: Package, color: 'from-pink-500 to-rose-500' },
    { label: '交易笔数', value: dashboard.total_transactions, icon: Activity, color: 'from-cyan-500 to-blue-500' },
    { label: '总交易额', value: dashboard.total_tx_amount?.toLocaleString(), icon: Coins, color: 'from-amber-500 to-orange-500' },
  ] : [];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">管理后台</h1>

      {msg && (
        <div className="bg-green-500/10 border border-green-500/30 text-green-300 px-4 py-3 rounded-xl text-sm flex justify-between">
          {msg}<button onClick={() => setMsg('')}>&times;</button>
        </div>
      )}

      <div className="flex gap-2 flex-wrap">
        {[['overview', '概览'], ['users', '用户'], ['orders', '订单'], ['products', '商品'], ['settings', '系统设置']].map(([k, v]) => (
          <button key={k} onClick={() => setTab(k)} className={`px-4 py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-1.5 ${tab === k ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'text-white/50'}`}>
            {k === 'settings' && <Settings size={14} />}
            {v}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {stats.map((s, i) => (
              <div key={i} className="card">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-white/50 text-sm">{s.label}</span>
                  <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${s.color} flex items-center justify-center`}>
                    <s.icon size={16} className="text-white" />
                  </div>
                </div>
                <p className="text-2xl font-bold">{s.value}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="card">
              <h3 className="font-semibold mb-3">最近订单</h3>
              <div className="space-y-2">
                {dashboard?.recent_orders?.slice(0, 5).map(o => (
                  <div key={o.id} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0 text-sm">
                    <div>
                      <p>{o.product_name}</p>
                      <p className="text-xs text-white/30">@{o.username}</p>
                    </div>
                    <span className="text-amber-400 font-mono">{o.total_price} GMC</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="card">
              <h3 className="font-semibold mb-3">最近交易</h3>
              <div className="space-y-2">
                {dashboard?.recent_transactions?.slice(0, 5).map(t => (
                  <div key={t.id} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0 text-sm">
                    <div>
                      <p>{t.note?.slice(0, 30)}</p>
                      <p className="text-xs text-white/30">{t.type}</p>
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
        <div className="space-y-3">
          {users.map(u => (
            <div key={u.id} className="card flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center font-bold text-sm">
                  {(u.nickname || 'U')[0]}
                </div>
                <div>
                  <p className="font-medium text-sm">{u.nickname} {u.is_admin && <span className="text-xs text-amber-400">[管理员]</span>}</p>
                  <p className="text-xs text-white/30">@{u.username} · {u.phone || '无手机号'}</p>
                  <p className="text-xs text-white/20 font-mono">{u.wallet_address}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <p className="font-mono text-amber-400">{u.balance?.toLocaleString()} GMC</p>
                  <p className="text-xs text-white/30">{new Date(u.created_at).toLocaleDateString('zh-CN')}</p>
                </div>
                <button onClick={() => setAdjustUser(u)} className="btn-secondary text-xs px-3 py-1.5">调整余额</button>
              </div>
            </div>
          ))}

          {adjustUser && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setAdjustUser(null)}>
              <div className="card w-full max-w-sm space-y-4" onClick={e => e.stopPropagation()}>
                <h3 className="font-semibold">调整余额 - {adjustUser.nickname}</h3>
                <p className="text-sm text-white/50">当前余额: {adjustUser.balance?.toLocaleString()} GMC</p>
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
        <div className="space-y-2">
          {orders.map(o => (
            <div key={o.id} className="card flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">{o.product_name} x{o.quantity}</p>
                <p className="text-xs text-white/30">@{o.username} · {new Date(o.created_at).toLocaleString('zh-CN')}</p>
                {o.shipping_address && <p className="text-xs text-white/20 mt-1">📍 {o.shipping_address} · {o.shipping_phone}</p>}
              </div>
              <div className="flex items-center gap-3">
                <span className="text-amber-400 font-mono text-sm">{o.total_price} GMC</span>
                <select value={o.status} onChange={e => handleUpdateOrder(o.id, e.target.value)}
                  className="input-field text-xs w-24 py-1.5">
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
        <div className="space-y-4">
          <div className="card space-y-3">
            <h3 className="font-semibold flex items-center gap-2"><Plus size={16} />添加商品</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <input className="input-field text-sm" placeholder="商品名称" value={newProduct.name}
                onChange={e => setNewProduct({...newProduct, name: e.target.value})} />
              <input className="input-field text-sm" placeholder="描述" value={newProduct.description}
                onChange={e => setNewProduct({...newProduct, description: e.target.value})} />
              <input type="number" className="input-field text-sm" placeholder="价格 (GMC)" value={newProduct.price}
                onChange={e => setNewProduct({...newProduct, price: e.target.value})} />
              <input className="input-field text-sm" placeholder="图标 (emoji)" value={newProduct.image}
                onChange={e => setNewProduct({...newProduct, image: e.target.value})} />
              <select className="input-field text-sm" value={newProduct.category}
                onChange={e => setNewProduct({...newProduct, category: e.target.value})}>
                <option value="virtual">虚拟商品</option>
                <option value="physical">实物商品</option>
              </select>
              <input type="number" className="input-field text-sm" placeholder="库存" value={newProduct.stock}
                onChange={e => setNewProduct({...newProduct, stock: e.target.value})} />
            </div>
            <button onClick={handleAddProduct} className="btn-primary text-sm">添加商品</button>
          </div>

          <div className="space-y-2">
            {products.map(p => (
              <div key={p.id} className="card flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{p.image || '📦'}</span>
                  <div>
                    <p className="text-sm font-medium">{p.name}</p>
                    <p className="text-xs text-white/30">{p.category === 'virtual' ? '虚拟' : '实物'} · 库存 {p.stock} · 已售 {p.sales || 0}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-amber-400 font-mono">{p.price} GMC</span>
                  <button onClick={() => handleDeleteProduct(p.id)} className="text-red-400/50 hover:text-red-400 text-sm">删除</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'settings' && (
        <div className="space-y-6">
          <div className="card space-y-5">
            <div className="flex items-center gap-3 pb-4 border-b border-white/10">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
                <Bot size={20} className="text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">AI 大模型配置</h3>
                <p className="text-xs text-white/40">配置 DashScope API Key 以启用 Qwen 大模型智能服务</p>
              </div>
            </div>

            <div className="bg-white/5 rounded-xl p-4 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-sm text-white/60">当前状态</span>
                {settings?.has_api_key ? (
                  <span className="text-xs px-3 py-1 rounded-full bg-green-500/15 text-green-400 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                    Qwen 模型已启用
                  </span>
                ) : (
                  <span className="text-xs px-3 py-1 rounded-full bg-white/10 text-white/40 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-white/30" />
                    本地模式
                  </span>
                )}
              </div>
              {settings?.has_api_key && settings?.dashscope_api_key_masked && (
                <p className="text-xs text-white/30 font-mono">已配置: {settings.dashscope_api_key_masked}</p>
              )}
            </div>

            <div>
              <label className="flex items-center gap-2 text-sm text-white/60 mb-2">
                <Key size={14} />
                DashScope API Key
              </label>
              <p className="text-xs text-white/30 mb-2">
                请前往 <a href="https://dashscope.console.aliyun.com/" target="_blank" rel="noopener" className="text-indigo-400 hover:text-indigo-300 underline">阿里云 DashScope 控制台</a> 获取 API Key
              </p>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type={showApiKey ? 'text' : 'password'}
                    className="input-field pr-10 font-mono text-sm"
                    placeholder={settings?.has_api_key ? '输入新的 API Key 以替换...' : '输入 DashScope API Key (sk-...)'}
                    value={apiKeyInput}
                    onChange={e => setApiKeyInput(e.target.value)}
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60"
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
              <label className="block text-sm text-white/60 mb-2">模型选择</label>
              <select className="input-field text-sm" value={modelInput} onChange={e => setModelInput(e.target.value)}>
                <option value="qwen3.5-flash">Qwen 3.5 Flash（推荐，速度快）</option>
                <option value="qwen-plus">Qwen Plus（更强）</option>
                <option value="qwen-turbo">Qwen Turbo（最快）</option>
                <option value="qwen-max">Qwen Max（最强）</option>
              </select>
            </div>

            <div>
              <label className="block text-sm text-white/60 mb-2">自定义系统提示词（可选）</label>
              <textarea
                className="input-field text-sm min-h-[80px] resize-y"
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
            <div className="space-y-2 text-sm text-white/50">
              <p>1. 在 <a href="https://dashscope.console.aliyun.com/" target="_blank" rel="noopener" className="text-indigo-400 hover:text-indigo-300">阿里云 DashScope</a> 注册并获取 API Key</p>
              <p>2. 将 API Key 填入上方输入框并保存</p>
              <p>3. 保存后，AI 助手将使用 Qwen 大模型进行智能对话</p>
              <p>4. 未配置 API Key 时，系统自动使用本地模式回复</p>
              <p>5. 用户也可在 AI 助手页面自行配置个人 API Key</p>
            </div>
          </div>

          <div className="card">
            <h3 className="font-semibold mb-3">管理员账号信息</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between py-2 border-b border-white/5">
                <span className="text-white/50">用户名</span>
                <span className="font-mono">admin</span>
              </div>
              <div className="flex justify-between py-2 border-b border-white/5">
                <span className="text-white/50">密码</span>
                <span className="font-mono">admin123</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-white/50">权限</span>
                <span className="text-amber-400">超级管理员</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
