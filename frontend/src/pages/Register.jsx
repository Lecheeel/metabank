import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { setUser } from '../utils/auth';
import api from '../utils/api';
import { UserPlus, Eye, EyeOff } from 'lucide-react';

export default function Register() {
  const [form, setForm] = useState({ username: '', password: '', nickname: '', phone: '' });
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.post('/auth/register', form);
      setUser(res.user, res.token);
      navigate('/app');
    } catch (err) {
      setError(err.detail || '注册失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-2xl font-bold animate-pulse-glow">M</div>
            <span className="text-2xl font-bold gradient-text">MetaBank</span>
          </Link>
          <h2 className="text-2xl font-bold mb-2">创建账户</h2>
          <p className="text-white/50">注册后将自动获得10,000国脉币和专属钱包地址</p>
        </div>

        <form onSubmit={handleSubmit} className="card space-y-5">
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-xl text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm text-white/60 mb-2">用户名 *</label>
            <input
              type="text"
              className="input-field"
              placeholder="请输入用户名"
              value={form.username}
              onChange={e => setForm({ ...form, username: e.target.value })}
              required
            />
          </div>

          <div>
            <label className="block text-sm text-white/60 mb-2">昵称</label>
            <input
              type="text"
              className="input-field"
              placeholder="请输入昵称（选填）"
              value={form.nickname}
              onChange={e => setForm({ ...form, nickname: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-sm text-white/60 mb-2">手机号</label>
            <input
              type="text"
              className="input-field"
              placeholder="请输入手机号（选填）"
              value={form.phone}
              onChange={e => setForm({ ...form, phone: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-sm text-white/60 mb-2">密码 *</label>
            <div className="relative">
              <input
                type={showPwd ? 'text' : 'password'}
                className="input-field pr-10"
                placeholder="请设置密码"
                value={form.password}
                onChange={e => setForm({ ...form, password: e.target.value })}
                required
              />
              <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60" onClick={() => setShowPwd(!showPwd)}>
                {showPwd ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2 py-3">
            <UserPlus size={18} />
            {loading ? '注册中...' : '注册'}
          </button>

          <p className="text-center text-sm text-white/50">
            已有账户？<Link to="/login" className="text-indigo-400 hover:text-indigo-300">立即登录</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
