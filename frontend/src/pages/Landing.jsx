import { Link } from 'react-router-dom';
import { Wallet, TrendingUp, MessageCircle, Bot, ShoppingBag, Shield } from 'lucide-react';

const features = [
  {
    icon: Wallet,
    title: '数字钱包',
    desc: '拥有专属区块链地址，安全管理您的国脉币资产',
    bg: 'bg-orange-50',
    iconBg: 'bg-orange-500',
  },
  {
    icon: TrendingUp,
    title: '智能交易所',
    desc: '买卖国脉币、期货、AI概念股，AI辅助决策',
    bg: 'bg-amber-50',
    iconBg: 'bg-amber-500',
  },
  {
    icon: ShoppingBag,
    title: '元宇宙商城',
    desc: '使用国脉币购买虚拟资产和实物商品',
    bg: 'bg-orange-50',
    iconBg: 'bg-orange-600',
  },
  {
    icon: MessageCircle,
    title: '社区互动',
    desc: '私聊转账、社区交流，构建金融社交网络',
    bg: 'bg-amber-50',
    iconBg: 'bg-amber-600',
  },
  {
    icon: Bot,
    title: 'AI 智能助手',
    desc: 'LLM 驱动的智能交易顾问，预测市场自动操作',
    bg: 'bg-orange-50',
    iconBg: 'bg-orange-500',
  },
  {
    icon: Shield,
    title: '安全可靠',
    desc: '基于区块链技术的安全架构，保障资产安全',
    bg: 'bg-amber-50',
    iconBg: 'bg-amber-500',
  },
];

export default function Landing() {
  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: '#ffffff', color: '#111827' }}
    >
      {/* ── 导航 ── */}
      <nav
        className="fixed top-0 inset-x-0 z-50"
        style={{
          background: 'rgba(255,255,255,0.92)',
          backdropFilter: 'blur(16px)',
          borderBottom: '1px solid #f3f4f6',
          boxShadow: '0 1px 8px rgba(0,0,0,0.06)',
        }}
      >
        <div style={{ maxWidth: '72rem', margin: '0 auto', padding: '1rem 2rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-lg font-bold animate-pulse-glow"
              style={{ background: 'linear-gradient(135deg,#f97316,#ea580c)' }}
            >
              M
            </div>
            <img src="https://mail.gmiot.com/customer/gmiot.com_logo.png" alt="国脉科技" style={{ height: '1.75rem' }} onError={(e) => { e.target.style.display = 'none'; }} />
            <div>
              <span className="font-bold gradient-text" style={{ fontSize: '1.25rem' }}>MetaBank</span>
              <p style={{ fontSize: '1rem', color: '#9ca3af' }}>元宇宙金融养老社区</p>
            </div>
          </div>
          {/* 按钮 */}
          <div className="flex items-center gap-3">
            <Link to="/login"    className="btn-secondary px-6 py-2.5">登录</Link>
            <Link to="/register" className="btn-primary px-6 py-2.5">注册</Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section
        style={{
          background: 'linear-gradient(180deg,#fff7ed 0%,#ffffff 100%)',
          paddingTop: '11rem',
          paddingBottom: '8rem',
          paddingLeft: '2.5rem',
          paddingRight: '2.5rem',
        }}
      >
        <div style={{ maxWidth: '48rem', margin: '0 auto', textAlign: 'center' }}>
          {/* 徽章 */}
          <div
            className="inline-flex items-center gap-2 rounded-full text-sm"
              style={{ background: '#fff7ed', border: '1px solid #fed7aa', color: '#c2410c', padding: '0.6rem 1.5rem', marginBottom: '3rem', fontSize: '1rem' }}
          >
            <img src="https://mail.gmiot.com/customer/gmiot.com_logo.png" alt="国脉科技" style={{ height: '1.25rem' }} onError={(e) => { e.target.style.display = 'none'; }} />
            FIT "国脉杯"软件设计大赛 · 队伍：冲冲冲
          </div>

          {/* 标题 */}
          <h1 className="text-5xl lg:text-7xl font-bold gradient-text leading-tight" style={{ marginBottom: '2rem' }}>
            MetaBank
          </h1>
          <p className="text-xl lg:text-2xl font-medium" style={{ color: '#374151', marginBottom: '1.5rem' }}>
            基于元宇宙技术构建的
            <span style={{ color: '#f97316' }}>金融养老社区</span>
          </p>
          <p style={{ fontSize: '1.125rem', color: '#6b7280', lineHeight: '1.9', marginBottom: '4rem', maxWidth: '42rem', marginLeft: 'auto', marginRight: 'auto' }}>
            解决老龄化群体的金融服务交互痛点，让每一位用户都能轻松享受数字金融服务
          </p>

          {/* CTA */}
          <div className="flex flex-wrap items-center justify-center" style={{ gap: '1.5rem', marginBottom: '6rem' }}>
            <Link to="/register" className="btn-primary px-10 py-4">立即体验</Link>
            <Link to="/login"    className="btn-secondary px-10 py-4">登录账户</Link>
          </div>

          {/* 统计卡片 */}
          <div className="grid grid-cols-3" style={{ gap: '2rem', maxWidth: '42rem', margin: '0 auto' }}>
            {[
              { value: '国脉币', sub: 'GMC Token',   color: '#f97316' },
              { value: 'AI驱动', sub: 'LLM智能助手', color: '#ea580c' },
              { value: '元宇宙', sub: '沉浸式体验',  color: '#d97706' },
            ].map((s, i) => (
              <div
                key={i}
                className="rounded-2xl text-center"
                style={{ background: '#fff7ed', border: '1px solid #fed7aa', padding: '2rem 1.5rem' }}
              >
                <div className="font-bold mb-1.5" style={{ fontSize: '1.5rem', color: s.color }}>{s.value}</div>
                <p style={{ fontSize: '1rem', color: '#9ca3af' }}>{s.sub}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 核心功能 ── */}
      <section style={{ background: '#fafaf8', padding: '8rem 2.5rem' }}>
        <div style={{ maxWidth: '72rem', margin: '0 auto' }}>
          <div className="text-center" style={{ marginBottom: '5rem' }}>
            <h2 className="text-3xl lg:text-4xl font-bold gradient-text" style={{ marginBottom: '1rem' }}>核心功能</h2>
            <p style={{ fontSize: '1.125rem', color: '#9ca3af' }}>六大模块，覆盖您的数字金融全场景</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3" style={{ gap: '2.5rem' }}>
            {features.map((f, i) => (
              <div
                key={i}
                className="rounded-2xl flex items-start transition-all duration-300 cursor-pointer group"
                style={{
                  padding: '2.5rem',
                  gap: '1.5rem',
                  background: '#ffffff',
                  border: '1px solid #e5e7eb',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = 'rgba(249,115,22,0.35)';
                  e.currentTarget.style.boxShadow = '0 8px 24px rgba(249,115,22,0.12)';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = '#e5e7eb';
                  e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.04)';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: 'linear-gradient(135deg,#f97316,#ea580c)' }}
                >
                  <f.icon size={22} color="#ffffff" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-semibold mb-2" style={{ fontSize: '1.125rem', color: '#111827' }}>{f.title}</h3>
                  <p className="leading-relaxed" style={{ fontSize: '1.0625rem', color: '#6b7280', lineHeight: '1.7' }}>{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 关于 ── */}
      <section style={{ background: '#ffffff', padding: '8rem 2.5rem' }}>
        <div style={{ maxWidth: '48rem', margin: '0 auto', textAlign: 'center' }}>
          <div
            className="rounded-2xl"
            style={{ background: '#fff7ed', border: '1px solid #fed7aa', padding: '3rem' }}
          >
            <img src="https://mail.gmiot.com/customer/gmiot.com_logo.png" alt="国脉科技" style={{ height: '2.5rem', marginBottom: '1rem' }} onError={(e) => { e.target.style.display = 'none'; }} />
            <h2 className="text-2xl font-bold gradient-text" style={{ marginBottom: '2rem' }}>关于国脉科技</h2>
            <p className="leading-loose" style={{ fontSize: '1.0625rem', color: '#6b7280', lineHeight: '1.9' }}>
              国脉科技股份有限公司（深交所：002093）成立于 2000 年，总部位于福州市马尾区，
              注册资本 100750 万元，主营物联网技术服务、咨询与设计服务、科学园运营及教育服务。
              MetaBank 是基于国脉科技物联网和 AI 技术打造的新一代金融养老社区平台。
            </p>
          </div>
        </div>
      </section>

      {/* ── 页脚 ── */}
      <footer
        className="text-center mt-auto"
        style={{ borderTop: '1px solid #f3f4f6', color: '#9ca3af', padding: '4rem 2.5rem', fontSize: '1.0625rem' }}
      >
        <img src="https://mail.gmiot.com/customer/gmiot.com_logo.png" alt="国脉科技" style={{ height: '1.5rem', marginBottom: '0.75rem', opacity: 0.8 }} onError={(e) => { e.target.style.display = 'none'; }} />
        <p>MetaBank © 2026 · FIT "国脉杯"软件设计大赛 · 队伍：冲冲冲</p>
        <p className="mt-2">Powered by 国脉科技 (002093) · 元宇宙 × AI × 区块链</p>
      </footer>
    </div>
  );
}
