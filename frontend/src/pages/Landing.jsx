import { Link } from 'react-router-dom';
import { Wallet, TrendingUp, MessageCircle, Bot, ShoppingBag, Shield } from 'lucide-react';

const features = [
  { icon: Wallet, title: '数字钱包', desc: '拥有专属区块链地址，安全管理您的国脉币资产', color: 'from-indigo-500 to-purple-500' },
  { icon: TrendingUp, title: '智能交易所', desc: '买卖国脉币、期货、AI概念股，AI辅助决策', color: 'from-cyan-500 to-blue-500' },
  { icon: ShoppingBag, title: '元宇宙商城', desc: '使用国脉币购买虚拟资产和实物商品', color: 'from-pink-500 to-rose-500' },
  { icon: MessageCircle, title: '社区互动', desc: '私聊转账、社区交流，构建金融社交网络', color: 'from-green-500 to-emerald-500' },
  { icon: Bot, title: 'AI智能助手', desc: 'LLM驱动的智能交易顾问，预测市场自动操作', color: 'from-amber-500 to-orange-500' },
  { icon: Shield, title: '安全可靠', desc: '基于区块链技术的安全架构，保障资产安全', color: 'from-violet-500 to-purple-500' },
];

export default function Landing() {
  return (
    <div className="min-h-screen">
      <nav className="fixed top-0 w-full z-50 glass-strong">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-xl font-bold animate-pulse-glow">M</div>
            <div>
              <h1 className="text-xl font-bold gradient-text">MetaBank</h1>
              <p className="text-xs text-white/40">元宇宙金融养老社区</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/login" className="btn-secondary text-sm">登录</Link>
            <Link to="/register" className="btn-primary text-sm">注册</Link>
          </div>
        </div>
      </nav>

      <section className="pt-32 pb-20 px-6">
        <div className="max-w-7xl mx-auto text-center">
          <div className="mb-6 inline-flex items-center gap-2 px-4 py-2 rounded-full glass text-sm text-white/70">
            <img src="https://mail.gmiot.com/customer/gmiot.com_logo.png" alt="国脉科技" className="h-5" onError={(e) => e.target.style.display = 'none'} />
            FIT "国脉杯"软件设计大赛 · 队伍：冲冲冲
          </div>
          <h1 className="text-5xl lg:text-7xl font-bold mb-6">
            <span className="gradient-text">MetaBank</span>
          </h1>
          <p className="text-xl lg:text-2xl text-white/60 mb-4 max-w-3xl mx-auto">
            基于元宇宙技术构建的<span className="text-cyan-400">金融养老社区</span>
          </p>
          <p className="text-base text-white/40 mb-10 max-w-2xl mx-auto">
            解决老龄化群体的金融服务交互痛点，让每一位用户都能轻松享受数字金融服务
          </p>
          <div className="flex items-center justify-center gap-4 mb-16">
            <Link to="/register" className="btn-primary text-lg px-8 py-3">立即体验</Link>
            <Link to="/login" className="btn-secondary text-lg px-8 py-3">登录账户</Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-4xl mx-auto mb-8">
            <div className="card text-center">
              <div className="text-3xl font-bold gradient-text mb-1">国脉币</div>
              <p className="text-sm text-white/50">GMC Token</p>
            </div>
            <div className="card text-center">
              <div className="text-3xl font-bold text-cyan-400 mb-1">AI驱动</div>
              <p className="text-sm text-white/50">LLM智能助手</p>
            </div>
            <div className="card text-center">
              <div className="text-3xl font-bold text-amber-400 mb-1">元宇宙</div>
              <p className="text-sm text-white/50">沉浸式体验</p>
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 px-6">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12 gradient-text">核心功能</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f, i) => (
              <div key={i} className="card group cursor-pointer">
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${f.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                  <f.icon size={24} className="text-white" />
                </div>
                <h3 className="text-lg font-bold mb-2">{f.title}</h3>
                <p className="text-white/50 text-sm">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 px-6">
        <div className="max-w-4xl mx-auto card text-center">
          <h2 className="text-2xl font-bold mb-3 gradient-text">关于国脉科技</h2>
          <p className="text-white/50 text-sm leading-relaxed">
            国脉科技股份有限公司（深交所：002093）成立于2000年，总部位于福州市马尾区，
            注册资本100750万元，主营物联网技术服务、物联网咨询与设计服务、科学园运营与开发服务、教育服务等。
            MetaBank是基于国脉科技物联网和AI技术打造的新一代金融养老社区平台。
          </p>
        </div>
      </section>

      <footer className="py-8 px-6 border-t border-white/10 text-center text-white/30 text-sm">
        <p>MetaBank © 2026 · FIT "国脉杯"软件设计大赛 · 队伍：冲冲冲</p>
        <p className="mt-1">Powered by 国脉科技 (002093) · 元宇宙 × AI × 区块链</p>
      </footer>
    </div>
  );
}
