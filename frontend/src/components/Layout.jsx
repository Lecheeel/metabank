import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { getUser, logout } from '../utils/auth';
import { LayoutDashboard, Wallet, ShoppingBag, TrendingUp, MessageCircle, Bot, Shield, LogOut, Menu, X } from 'lucide-react';
import { useState } from 'react';

const navItems = [
  { path: '/app', icon: LayoutDashboard, label: '仪表盘', end: true },
  { path: '/app/wallet', icon: Wallet, label: '钱包' },
  { path: '/app/shop', icon: ShoppingBag, label: '商城' },
  { path: '/app/exchange', icon: TrendingUp, label: '交易所' },
  { path: '/app/chat', icon: MessageCircle, label: '社区' },
  { path: '/app/ai', icon: Bot, label: 'AI助手' },
];

export default function Layout() {
  const user = getUser();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden">
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <aside className={`fixed lg:static inset-y-0 left-0 z-50 w-64 glass-strong flex flex-col transition-transform duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="p-5 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-xl font-bold">M</div>
            <div>
              <h1 className="text-lg font-bold gradient-text">MetaBank</h1>
              <p className="text-xs text-white/40">元宇宙金融社区</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navItems.map(item => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.end}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                  isActive
                    ? 'bg-gradient-to-r from-indigo-500/20 to-purple-500/20 text-white border border-indigo-500/30'
                    : 'text-white/60 hover:text-white hover:bg-white/5'
                }`
              }
            >
              <item.icon size={20} />
              <span className="font-medium">{item.label}</span>
            </NavLink>
          ))}
          {user?.is_admin && (
            <NavLink
              to="/app/admin"
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                  isActive
                    ? 'bg-gradient-to-r from-amber-500/20 to-orange-500/20 text-amber-400 border border-amber-500/30'
                    : 'text-amber-400/60 hover:text-amber-400 hover:bg-white/5'
                }`
              }
            >
              <Shield size={20} />
              <span className="font-medium">管理后台</span>
            </NavLink>
          )}
        </nav>

        <div className="p-4 border-t border-white/10">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center text-sm font-bold">
              {(user?.nickname || 'U')[0]}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user?.nickname}</p>
              <p className="text-xs text-white/40 truncate">{user?.wallet_address?.slice(0, 12)}...</p>
            </div>
          </div>
          <button onClick={logout} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400/70 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all">
            <LogOut size={16} />
            退出登录
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="lg:hidden glass-strong px-4 py-3 flex items-center gap-3">
          <button onClick={() => setSidebarOpen(true)} className="text-white/70 hover:text-white">
            <Menu size={24} />
          </button>
          <h1 className="text-lg font-bold gradient-text">MetaBank</h1>
        </header>
        <div className="flex-1 overflow-y-auto p-4 lg:p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
