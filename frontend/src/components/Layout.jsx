import { Outlet, NavLink } from 'react-router-dom';
import { getUser, logout } from '../utils/auth';
import {
  LayoutDashboard, Wallet, ShoppingBag, TrendingUp,
  MessageCircle, Bot, Shield, LogOut, Menu,
  HeartHandshake, ShieldCheck, Type,
} from 'lucide-react';
import { useState } from 'react';
import { useAccessibility } from '../utils/accessibility.jsx';
import VoiceBar from './VoiceBar.jsx';

const navItems = [
  { path: '/app',          icon: LayoutDashboard, label: '仪表盘', end: true },
  { path: '/app/wallet',   icon: Wallet,           label: '钱包' },
  { path: '/app/shop',     icon: ShoppingBag,      label: '商城' },
  { path: '/app/exchange', icon: TrendingUp,        label: '交易所' },
  { path: '/app/chat',     icon: MessageCircle,     label: '社区' },
  { path: '/app/ai',       icon: Bot,               label: 'AI助手' },
  { path: '/app/elder',    icon: HeartHandshake,    label: '老年顾问' },
  { path: '/app/guardian', icon: ShieldCheck,       label: '监护中心' },
];

export default function Layout() {
  const user = getUser();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { fontScale, toggleFontScale } = useAccessibility();
  const isLarge = fontScale === 'large';

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#f9fafb' }}>
      {/* 移动遮罩 */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 lg:hidden"
          style={{ background: 'rgba(0,0,0,0.3)' }}
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* 侧边栏 */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-40 w-64 flex flex-col transition-transform duration-300 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
        style={{
          background: '#ffffff',
          borderRight: '1px solid #e5e7eb',
          boxShadow: '2px 0 8px rgba(0,0,0,0.04)',
        }}
      >
        {/* Logo */}
        <div className="px-5 py-4" style={{ borderBottom: '1px solid #f3f4f6' }}>
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-lg font-bold animate-pulse-glow"
              style={{ background: 'linear-gradient(135deg,#f97316,#ea580c)' }}
            >
              M
            </div>
            <img src="https://mail.gmiot.com/customer/gmiot.com_logo.png" alt="国脉科技" style={{ height: '1.5rem' }} onError={(e) => { e.target.style.display = 'none'; }} />
            <div>
              <h1 className="font-bold gradient-text" style={{ fontSize: '1.25rem' }}>MetaBank</h1>
              <p style={{ fontSize: '1rem', color: '#9ca3af' }}>元宇宙金融社区</p>
            </div>
          </div>
        </div>

        {/* 导航 */}
        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {navItems.map(item => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.end}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all ${
                  isActive
                    ? 'text-orange-600'
                    : 'text-gray-600 hover:text-gray-900'
                }`
              }
              style={({ isActive }) => ({
                fontSize: '1.0625rem',
                ...(isActive ? { background: '#fff7ed', color: '#ea580c' } : {})
              })}
            >
              <item.icon size={20} className="flex-shrink-0" />
              <span className="truncate">{item.label}</span>
            </NavLink>
          ))}

          {user?.is_admin && (
            <NavLink
              to="/app/admin"
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all ${
                  isActive ? '' : 'hover:text-gray-900'
                }`
              }
              style={({ isActive }) => ({
                fontSize: '1.0625rem',
                ...(isActive ? { background: '#fff7ed', color: '#d97706' } : { color: '#d97706' })
              })}
            >
              <Shield size={20} className="flex-shrink-0" />
              <span className="truncate">管理后台</span>
            </NavLink>
          )}
        </nav>

        {/* 用户信息 */}
        <div className="p-4" style={{ borderTop: '1px solid #f3f4f6' }}>
          <button
            onClick={toggleFontScale}
            className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg mb-3 transition-all"
            style={{
              background: isLarge ? 'linear-gradient(135deg,#f97316,#ea580c)' : '#fff7ed',
              color: isLarge ? '#ffffff' : '#ea580c',
              border: '1px solid #fed7aa',
              fontSize: '1rem',
              fontWeight: 600,
            }}
            title="切换大字模式"
            aria-label={isLarge ? '切换到标准字号' : '切换到大字模式'}
          >
            <span className="flex items-center gap-2">
              <Type size={18} />
              {isLarge ? '大字模式 · 开' : '大字模式 · 关'}
            </span>
            <span style={{ fontSize: '0.875rem', opacity: 0.85 }}>{isLarge ? 'Aa' : 'aa'}</span>
          </button>
          <div className="flex items-center gap-3 mb-3">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
              style={{ background: 'linear-gradient(135deg,#f97316,#ea580c)' }}
            >
              {(user?.nickname || 'U')[0]}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate" style={{ fontSize: '1.0625rem', color: '#111827' }}>{user?.nickname}</p>
              <p className="truncate" style={{ fontSize: '0.9375rem', color: '#9ca3af' }}>{user?.wallet_address?.slice(0, 10)}...</p>
            </div>
          </div>
          <button
            onClick={logout}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-all"
            style={{ fontSize: '1.0625rem', color: '#ef4444' }}
            onMouseEnter={e => { e.currentTarget.style.background = '#fef2f2'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
          >
            <LogOut size={18} />
            退出登录
          </button>
        </div>
      </aside>

      {/* 主内容 */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* 移动端顶栏 */}
        <header
          className="lg:hidden px-4 py-3 flex items-center gap-3"
          style={{ background: '#ffffff', borderBottom: '1px solid #e5e7eb' }}
        >
          <button
            onClick={() => setSidebarOpen(true)}
            style={{ color: '#6b7280' }}
            className="hover:text-orange-500 transition-colors"
          >
            <Menu size={22} />
          </button>
          <span className="font-bold gradient-text" style={{ fontSize: '1.25rem' }}>MetaBank</span>
          <button
            onClick={toggleFontScale}
            className="ml-auto flex items-center gap-1 px-3 py-1.5 rounded-lg"
            style={{
              background: isLarge ? 'linear-gradient(135deg,#f97316,#ea580c)' : '#fff7ed',
              color: isLarge ? '#ffffff' : '#ea580c',
              border: '1px solid #fed7aa',
              fontSize: '0.875rem',
              fontWeight: 600,
            }}
            aria-label="切换大字模式"
          >
            <Type size={16} />{isLarge ? '大字开' : '大字'}
          </button>
        </header>

        <div className="flex-1 overflow-y-auto" style={{ padding: '2rem 1.5rem' }}>
          <div style={{ maxWidth: '72rem', margin: '0 auto', fontSize: '1.125rem' }}>
            <Outlet />
          </div>
        </div>
      </main>
      <VoiceBar />
    </div>
  );
}
