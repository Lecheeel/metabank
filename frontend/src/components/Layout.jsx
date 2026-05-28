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

const primaryNavItems = [
  { path: '/app',          icon: LayoutDashboard, label: '仪表盘', end: true },
  { path: '/app/wallet',   icon: Wallet,           label: '钱包' },
  { path: '/app/shop',     icon: ShoppingBag,      label: '商城' },
  { path: '/app/exchange', icon: TrendingUp,        label: '交易所' },
  { path: '/app/chat',     icon: MessageCircle,     label: '社区' },
];

const smartNavItems = [
  { path: '/app/ai',       icon: Bot,               label: 'AI助手' },
  { path: '/app/elder',    icon: HeartHandshake,    label: '老年顾问' },
];

const safetyNavItems = [
  { path: '/app/guardian', icon: ShieldCheck,       label: '监护中心' },
];

export default function Layout() {
  const user = getUser();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { fontScale, toggleFontScale } = useAccessibility();
  const isLarge = fontScale === 'large';
  const navGroups = [
    { title: '核心功能', items: primaryNavItems },
    { title: '智能服务', items: smartNavItems },
    {
      title: '安全管理',
      items: user?.is_admin
        ? [...safetyNavItems, { path: '/app/admin', icon: Shield, label: '管理后台' }]
        : safetyNavItems,
    },
  ];
  const userInitial = (user?.nickname || 'U').trim().charAt(0) || 'U';

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
        className={`app-sidebar fixed lg:static inset-y-0 left-0 z-40 flex flex-col flex-shrink-0 transition-transform duration-300 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Logo */}
        <div className="app-sidebar-brand">
          <div className="app-sidebar-brand-shell">
            <div className="app-sidebar-brand-mark">
              M
            </div>
            <div className="app-sidebar-brand-copy">
              <h1 className="app-sidebar-brand-title gradient-text">MetaBank</h1>
              <p className="app-sidebar-brand-subtitle">金融养老社区</p>
            </div>
          </div>
        </div>

        {/* 导航 */}
        <nav className="app-sidebar-nav">
          {navGroups.map(group => (
            <section key={group.title} className="app-sidebar-group" aria-label={group.title}>
              <p className="app-sidebar-group-title">{group.title}</p>
              <div className="app-sidebar-group-items">
                {group.items.map(item => (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    end={item.end}
                    onClick={() => setSidebarOpen(false)}
                    className={({ isActive }) =>
                      isActive ? 'app-sidebar-link app-sidebar-link-active' : 'app-sidebar-link'
                    }
                  >
                    <item.icon size={20} className="flex-shrink-0" />
                    <span className="app-sidebar-link-label">{item.label}</span>
                  </NavLink>
                ))}
              </div>
            </section>
          ))}
        </nav>

        {/* 用户信息 */}
        <div className="app-sidebar-footer">
          <button
            onClick={toggleFontScale}
            className={`app-sidebar-font-button${isLarge ? ' app-sidebar-font-button-active' : ''}`}
            title="切换大字模式"
            aria-label={isLarge ? '切换到标准字号' : '切换到大字模式'}
          >
            <span className="app-sidebar-font-copy">
              <Type size={18} />
              大字模式
            </span>
            <span className="app-sidebar-font-state">{isLarge ? '已开' : '已关'}</span>
          </button>
          <div className="app-sidebar-user-row">
            <div className="app-sidebar-avatar">
              {userInitial}
            </div>
            <div className="app-sidebar-user-copy">
              <p className="app-sidebar-user-name">{user?.nickname}</p>
              <p className="app-sidebar-user-wallet">{user?.wallet_address?.slice(0, 10)}...</p>
            </div>
          </div>
          <button
            onClick={logout}
            className="app-sidebar-logout"
          >
            <LogOut size={18} />
            退出登录
          </button>
        </div>
      </aside>

      {/* 主内容 */}
      <main className="flex-1 min-w-0 flex flex-col overflow-hidden">
        {/* 移动端顶栏 */}
        <header
          className="lg:hidden px-4 py-3 flex items-center gap-3"
          style={{ background: '#ffffff', borderBottom: '1px solid #e5e7eb' }}
        >
          <button
            onClick={() => setSidebarOpen(true)}
            className="ui-icon-button"
          >
            <Menu size={22} />
          </button>
          <span className="font-bold gradient-text" style={{ fontSize: '1.25rem' }}>MetaBank</span>
          <button
            onClick={toggleFontScale}
            className={`ml-auto ${isLarge ? 'ui-pill-button ui-pill-button-active' : 'ui-pill-button'}`}
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
