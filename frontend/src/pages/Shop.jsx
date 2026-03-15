import { useState, useEffect } from 'react';
import api from '../utils/api';
import { ShoppingCart, Package, Truck, Star, X } from 'lucide-react';

export default function Shop() {
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [tab, setTab] = useState('products');
  const [category, setCategory] = useState('all');
  const [buyModal, setBuyModal] = useState(null);
  const [buyForm, setBuyForm] = useState({ quantity: 1, shipping_address: '', shipping_phone: '' });
  const [msg, setMsg] = useState('');

  useEffect(() => {
    api.get('/shop/products').then(setProducts);
    api.get('/shop/orders').then(setOrders).catch(() => {});
  }, []);

  const handleBuy = async () => {
    try {
      const res = await api.post('/shop/order', {
        product_id: buyModal.id,
        ...buyForm,
        quantity: parseInt(buyForm.quantity)
      });
      setMsg(`购买成功！扣除 ${res.order.total_price} 国脉币`);
      setBuyModal(null);
      setBuyForm({ quantity: 1, shipping_address: '', shipping_phone: '' });
      api.get('/shop/orders').then(setOrders);
    } catch (err) {
      setMsg(err.detail || '购买失败');
    }
  };

  const filtered = category === 'all' ? products : products.filter(p => p.category === category);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">元宇宙商城</h1>
        <div className="flex gap-2">
          <button onClick={() => setTab('products')} className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${tab === 'products' ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30' : 'text-white/50 hover:text-white'}`}>
            <ShoppingCart size={16} className="inline mr-1" />商品
          </button>
          <button onClick={() => setTab('orders')} className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${tab === 'orders' ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30' : 'text-white/50 hover:text-white'}`}>
            <Package size={16} className="inline mr-1" />订单
          </button>
        </div>
      </div>

      {msg && (
        <div className="bg-green-500/10 border border-green-500/30 text-green-300 px-4 py-3 rounded-xl text-sm flex items-center justify-between">
          {msg}
          <button onClick={() => setMsg('')}>&times;</button>
        </div>
      )}

      {tab === 'products' && (
        <>
          <div className="flex gap-2 flex-wrap">
            {[['all', '全部'], ['virtual', '虚拟商品'], ['physical', '实物商品']].map(([k, v]) => (
              <button key={k} onClick={() => setCategory(k)} className={`px-4 py-2 rounded-full text-sm transition-all ${category === k ? 'bg-white/10 text-white border border-white/20' : 'text-white/40 hover:text-white/70'}`}>
                {v}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map(p => (
              <div key={p.id} className="card group">
                <div className="text-5xl text-center mb-4 group-hover:scale-110 transition-transform">
                  {p.image || '📦'}
                </div>
                <h3 className="font-semibold text-base mb-1">{p.name}</h3>
                <p className="text-xs text-white/40 mb-3 line-clamp-2">{p.description}</p>
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-lg font-bold text-amber-400">{p.price}</span>
                    <span className="text-xs text-white/40 ml-1">GMC</span>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full ${p.category === 'virtual' ? 'bg-cyan-500/15 text-cyan-400' : 'bg-orange-500/15 text-orange-400'}`}>
                    {p.category === 'virtual' ? '虚拟' : '实物'}
                  </span>
                </div>
                <div className="flex items-center justify-between mt-3 text-xs text-white/30">
                  <span>库存 {p.stock}</span>
                  <span>已售 {p.sales || 0}</span>
                </div>
                <button onClick={() => setBuyModal(p)} className="btn-primary w-full mt-3 text-sm py-2">
                  购买
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      {tab === 'orders' && (
        <div className="space-y-3">
          {orders.map(o => (
            <div key={o.id} className="card flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  o.status === 'completed' ? 'bg-green-500/15 text-green-400' : 'bg-amber-500/15 text-amber-400'
                }`}>
                  {o.status === 'completed' ? <Star size={20} /> : <Truck size={20} />}
                </div>
                <div>
                  <p className="font-medium text-sm">{o.product_name} x{o.quantity}</p>
                  <p className="text-xs text-white/40">{new Date(o.created_at).toLocaleString('zh-CN')}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-mono text-amber-400">{o.total_price} GMC</p>
                <p className={`text-xs ${o.status === 'completed' ? 'text-green-400' : 'text-amber-400'}`}>
                  {o.status === 'completed' ? '已完成' : o.status === 'pending_ship' ? '待发货' : o.status}
                </p>
              </div>
            </div>
          ))}
          {orders.length === 0 && <div className="card text-center text-white/40 py-8">暂无订单</div>}
        </div>
      )}

      {buyModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setBuyModal(null)}>
          <div className="card w-full max-w-md space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">购买商品</h3>
              <button onClick={() => setBuyModal(null)} className="text-white/40 hover:text-white"><X size={20} /></button>
            </div>
            <div className="text-center text-4xl mb-2">{buyModal.image || '📦'}</div>
            <h4 className="font-semibold text-center">{buyModal.name}</h4>
            <p className="text-center text-amber-400 text-xl font-bold">{buyModal.price} GMC</p>

            <div>
              <label className="block text-sm text-white/60 mb-2">数量</label>
              <input type="number" min="1" className="input-field" value={buyForm.quantity}
                onChange={e => setBuyForm({...buyForm, quantity: e.target.value})} />
            </div>

            {buyModal.category === 'physical' && (
              <>
                <div>
                  <label className="block text-sm text-white/60 mb-2">收货地址 *</label>
                  <input className="input-field" placeholder="请输入完整收货地址" value={buyForm.shipping_address}
                    onChange={e => setBuyForm({...buyForm, shipping_address: e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm text-white/60 mb-2">手机号 *</label>
                  <input className="input-field" placeholder="请输入手机号" value={buyForm.shipping_phone}
                    onChange={e => setBuyForm({...buyForm, shipping_phone: e.target.value})} />
                </div>
              </>
            )}

            <div className="bg-white/5 rounded-xl p-3 text-sm">
              <div className="flex justify-between">
                <span className="text-white/50">小计</span>
                <span className="text-amber-400 font-bold">{buyModal.price * (parseInt(buyForm.quantity) || 1)} GMC</span>
              </div>
            </div>

            <button onClick={handleBuy} className="btn-primary w-full py-3">确认购买</button>
          </div>
        </div>
      )}
    </div>
  );
}
