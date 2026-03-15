import { useState, useEffect } from 'react';
import api from '../utils/api';
import { Users, ShoppingBag, TrendingUp, Activity, Package, Coins, Plus, Minus } from 'lucide-react';

export default function Admin() {
  const [dashboard, setDashboard] = useState(null);
  const [users, setUsers] = useState([]);
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [tab, setTab] = useState('overview');
  const [adjustUser, setAdjustUser] = useState(null);
  const [adjustAmount, setAdjustAmount] = useState('');
  const [newProduct, setNewProduct] = useState({ name: '', description: '', price: '', image: '', category: 'virtual', stock: '999' });
  const [msg, setMsg] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    api.get('/admin/dashboard').then(setDashboard).catch(() => {});
    api.get('/admin/users').then(setUsers).catch(() => {});
    api.get('/admin/orders').then(setOrders).catch(() => {});
    api.get('/admin/products').then(setProducts).catch(() => {});
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
        {[['overview', '概览'], ['users', '用户'], ['orders', '订单'], ['products', '商品']].map(([k, v]) => (
          <button key={k} onClick={() => setTab(k)} className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${tab === k ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'text-white/50'}`}>{v}</button>
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
    </div>
  );
}
