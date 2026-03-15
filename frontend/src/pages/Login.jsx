import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { setUser } from '../utils/auth';
import api from '../utils/api';
import { LogIn, Eye, EyeOff } from 'lucide-react';

export default function Login() {
  const [form, setForm] = useState({ username: '', password: '' });
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.post('/auth/login', form);
      setUser(res.user, res.token);
      navigate('/app');
    } catch (err) {
      setError(err.detail || '登录失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-2xl font-bold animate-pulse-glow">M</div>
            <span className="text-2xl font-bold gradient-text">MetaBank</span>
          </Link>
          <h2 className="text-2xl font-bold mb-2">欢迎回来</h2>
          <p className="text-white/50">登录您的MetaBank账户</p>
        </div>

        <form onSubmit={handleSubmit} className="card space-y-5">
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-xl text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm text-white/60 mb-2">用户名</label>
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
            <label className="block text-sm text-white/60 mb-2">密码</label>
            <div className="relative">
              <input
                type={showPwd ? 'text' : 'password'}
                className="input-field pr-10"
                placeholder="请输入密码"
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
            <LogIn size={18} />
            {loading ? '登录中...' : '登录'}
          </button>

          <p className="text-center text-sm text-white/50">
            还没有账户？<Link to="/register" className="text-indigo-400 hover:text-indigo-300">立即注册</Link>
          </p>

          <div className="pt-3 border-t border-white/10 text-center text-xs text-white/30">
            <p>管理员账户：admin / admin123</p>
          </div>
        </form>
      </div>
    </div>
  );
}
