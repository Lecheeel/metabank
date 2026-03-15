# MetaBank - 元宇宙金融养老社区

> FIT "国脉杯"软件设计大赛 · 队伍：冲冲冲

基于元宇宙技术构建的金融养老社区平台，解决老龄化群体的金融服务交互痛点。

## 功能特色

- **数字钱包** - 专属区块链地址，安全管理国脉币资产
- **元宇宙商城** - 使用国脉币购买虚拟资产和实物商品
- **智能交易所** - 买卖国脉币、期货、AI概念股（国脉科技 002093）
- **社区互动** - 私聊转账、代币转让，突出钱包地址
- **AI智能助手** - LLM驱动的交易顾问、市场预测、自动定投
- **管理后台** - 用户管理、商品管理、订单管理

## 技术栈

- **后端**: Python FastAPI + JSON文件存储
- **前端**: React + Vite + TailwindCSS + Recharts
- **认证**: JWT Token
- **UI**: 玻璃拟态风格 + 渐变设计
- **版本控制**: Git

## 开发与版本控制

本项目使用 **Git** 进行版本管理，支持团队协作与代码追溯。

```bash
# 克隆项目
git clone <repository-url>
cd metabank

# 查看提交历史
git log --oneline

# 拉取最新代码
git pull origin main
```

## 快速启动

### 后端

```bash
cd backend
pip install -r requirements.txt
python3 main.py
```

后端将在 http://localhost:8000 启动

### 前端

```bash
cd frontend
npm install
npm run dev
```

前端将在 http://localhost:5173 启动

### 默认账户

- 管理员: `admin` / `admin123`
- 新注册用户自动获得 10,000 国脉币

## 关于

**国脉科技股份有限公司** (深交所: 002093)
- 成立于 2000年12月29日
- 法定代表人：陈学华
- 总部：福州市马尾区江滨东大道116号
- 注册资本：100750万元
- 主营：物联网技术服务、物联网咨询与设计服务、科学园运营与开发服务、教育服务
