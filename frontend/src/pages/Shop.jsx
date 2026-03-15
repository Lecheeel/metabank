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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
      <div className="flex items-center justify-between">
        <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: '#111827' }}>元宇宙商城</h1>
        <div className="flex gap-2">
          <button onClick={() => setTab('products')} className={`px-4 py-2 rounded-xl font-medium transition-all ${tab === 'products' ? 'bg-orange-50 text-orange-400 border border-orange-200' : 'text-gray-500 hover:text-gray-900'}`} style={{ fontSize: '1rem' }}>
            <ShoppingCart size={18} className="inline mr-1" />商品
          </button>
          <button onClick={() => setTab('orders')} className={`px-4 py-2 rounded-xl font-medium transition-all ${tab === 'orders' ? 'bg-orange-50 text-orange-400 border border-orange-200' : 'text-gray-500 hover:text-gray-900'}`} style={{ fontSize: '1rem' }}>
            <Package size={18} className="inline mr-1" />订单
          </button>
        </div>
      </div>

      {msg && (
        <div className="px-4 py-3 rounded-xl flex items-center justify-between" style={{ background: '#dcfce7', border: '1px solid #86efac', color: '#15803d', fontSize: '1rem' }}>
          {msg}
          <button onClick={() => setMsg('')}>&times;</button>
        </div>
      )}

      {tab === 'products' && (
        <>
          <div className="flex gap-2 flex-wrap">
            {[['all', '全部'], ['virtual', '虚拟商品'], ['physical', '实物商品']].map(([k, v]) => (
              <button key={k} onClick={() => setCategory(k)} className={`px-4 py-2 rounded-full transition-all ${category === k ? 'bg-orange-50 text-orange-600 border border-orange-200' : 'text-gray-400 hover:text-gray-600'}`} style={{ fontSize: '1rem' }}>
                {v}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" style={{ gap: '1.5rem' }}>
            {filtered.map(p => (
              <div key={p.id} className="card group">
                <div className="text-5xl text-center group-hover:scale-110 transition-transform" style={{ marginBottom: '1.25rem' }}>
                  {p.image || '📦'}
                </div>
                <h3 className="font-semibold mb-1" style={{ fontSize: '1.125rem' }}>{p.name}</h3>
                <p className="line-clamp-2 mb-3" style={{ fontSize: '1.0625rem', color: '#6b7280' }}>{p.description}</p>
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-bold text-amber-400" style={{ fontSize: '1.25rem' }}>{p.price}</span>
                    <span style={{ fontSize: '1.0625rem', color: '#6b7280', marginLeft: '0.25rem' }}>GMC</span>
                  </div>
                  <span className={`px-2.5 py-1 rounded-full ${p.category === 'virtual' ? 'bg-sky-50 text-sky-600' : 'bg-orange-500/15 text-orange-400'}`} style={{ fontSize: '1.0625rem' }}>
                    {p.category === 'virtual' ? '虚拟' : '实物'}
                  </span>
                </div>
                <div className="flex items-center justify-between mt-4" style={{ fontSize: '1.0625rem', color: '#6b7280' }}>
                  <span>库存 {p.stock}</span>
                  <span>已售 {p.sales || 0}</span>
                </div>
                <button onClick={() => setBuyModal(p)} className="btn-primary w-full mt-4" style={{ fontSize: '1rem', padding: '0.75rem' }}>
                  购买
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      {tab === 'orders' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {orders.map(o => (
            <div key={o.id} className="card flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                  o.status === 'completed' ? 'bg-green-500/15 text-green-400' : 'bg-amber-500/15 text-amber-400'
                }`}>
                  {o.status === 'completed' ? <Star size={24} /> : <Truck size={24} />}
                </div>
                <div>
                  <p className="font-medium" style={{ fontSize: '1rem' }}>{o.product_name} x{o.quantity}</p>
                  <p style={{ fontSize: '1.0625rem', color: '#6b7280' }}>{new Date(o.created_at).toLocaleString('zh-CN')}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-mono text-amber-400" style={{ fontSize: '1.125rem' }}>{o.total_price} GMC</p>
                <p style={{ fontSize: '1.0625rem', ...(o.status === 'completed' ? { color: '#22c55e' } : { color: '#f59e0b' }) }}>
                  {o.status === 'completed' ? '已完成' : o.status === 'pending_ship' ? '待发货' : o.status}
                </p>
              </div>
            </div>
          ))}
          {orders.length === 0 && <div className="card text-center text-gray-400 py-8" style={{ fontSize: '1.125rem' }}>暂无订单</div>}
        </div>
      )}

      {buyModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setBuyModal(null)}>
          <div className="card w-full max-w-md" onClick={e => e.stopPropagation()} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div className="flex items-center justify-between">
              <h3 className="font-semibold" style={{ fontSize: '1.25rem' }}>购买商品</h3>
              <button onClick={() => setBuyModal(null)} className="text-gray-400 hover:text-gray-900"><X size={24} /></button>
            </div>
            <div className="text-center mb-2" style={{ fontSize: '3rem' }}>{buyModal.image || '📦'}</div>
            <h4 className="font-semibold text-center" style={{ fontSize: '1.25rem' }}>{buyModal.name}</h4>
            <p className="text-center text-amber-400 font-bold" style={{ fontSize: '1.5rem' }}>{buyModal.price} GMC</p>

            <div>
              <label className="block mb-2" style={{ fontSize: '1rem', color: '#6b7280' }}>数量</label>
              <input type="number" min="1" className="input-field" value={buyForm.quantity}
                onChange={e => setBuyForm({...buyForm, quantity: e.target.value})} style={{ fontSize: '1rem' }} />
            </div>

            {buyModal.category === 'physical' && (
              <>
                <div>
                  <label className="block mb-2" style={{ fontSize: '1rem', color: '#6b7280' }}>收货地址 *</label>
                  <input className="input-field" placeholder="请输入完整收货地址" value={buyForm.shipping_address}
                    onChange={e => setBuyForm({...buyForm, shipping_address: e.target.value})} style={{ fontSize: '1rem' }} />
                </div>
                <div>
                  <label className="block mb-2" style={{ fontSize: '1rem', color: '#6b7280' }}>手机号 *</label>
                  <input className="input-field" placeholder="请输入手机号" value={buyForm.shipping_phone}
                    onChange={e => setBuyForm({...buyForm, shipping_phone: e.target.value})} style={{ fontSize: '1rem' }} />
                </div>
              </>
            )}

            <div className="bg-gray-50 rounded-xl" style={{ padding: '1rem', fontSize: '1rem' }}>
              <div className="flex justify-between">
                <span style={{ color: '#6b7280' }}>小计</span>
                <span className="text-amber-400 font-bold">{buyModal.price * (parseInt(buyForm.quantity) || 1)} GMC</span>
              </div>
            </div>

            <button onClick={handleBuy} className="btn-primary w-full" style={{ fontSize: '1rem', padding: '1rem' }}>确认购买</button>
          </div>
        </div>
      )}
    </div>
  );
}
