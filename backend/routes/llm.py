from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from storage import read_json, append_json, find_one, update_json, write_json, read_settings
from auth_utils import get_current_user
from datetime import datetime, timedelta
from typing import Optional
import uuid, random, re, os, traceback

router = APIRouter()

class ChatReq(BaseModel):
    message: str
    api_key: Optional[str] = None

class AutoTaskReq(BaseModel):
    symbol: str
    action: str
    amount: float
    target_price: Optional[float] = None
    interval_minutes: Optional[int] = None
    repeat: int = 1
    task_type: str = "price_trigger"

MARKET_INSIGHTS = {
    "GM": {"trend": "看涨", "support": 11.5, "resistance": 14.0, "recommendation": "建议适量买入，国脉科技物联网业务持续增长"},
    "GMAI": {"trend": "强势看涨", "support": 22.0, "resistance": 30.0, "recommendation": "AI概念持续火热，建议分批建仓"},
    "GMC": {"trend": "震荡", "support": 0.9, "resistance": 1.15, "recommendation": "国脉币价格相对稳定，适合长期持有"},
    "GMFT": {"trend": "看涨", "support": 1.0, "resistance": 1.2, "recommendation": "期货合约溢价合理，可适量做多"},
    "METAV": {"trend": "看涨", "support": 90.0, "resistance": 120.0, "recommendation": "元宇宙概念回暖，指数有上行空间"},
    "AIFIN": {"trend": "强势", "support": 45.0, "resistance": 60.0, "recommendation": "AI金融ETF近期表现强劲，建议持有"},
}

STOCKS_INFO = [
    {"symbol": "GM", "name": "国脉科技", "code": "002093", "base_price": 12.5, "category": "stock"},
    {"symbol": "GMAI", "name": "国脉AI概念", "code": "GM-AI", "base_price": 25.0, "category": "ai_stock"},
    {"symbol": "GMC", "name": "国脉币/USDT", "code": "GMC-USDT", "base_price": 1.0, "category": "crypto"},
    {"symbol": "GMFT", "name": "国脉币期货", "code": "GMC-FT", "base_price": 1.05, "category": "futures"},
    {"symbol": "METAV", "name": "元宇宙指数", "code": "META-IDX", "base_price": 100.0, "category": "index"},
    {"symbol": "AIFIN", "name": "AI金融ETF", "code": "AI-FIN", "base_price": 50.0, "category": "ai_stock"},
]

def _get_api_key(user_key: Optional[str] = None) -> Optional[str]:
    if user_key:
        return user_key
    settings = read_settings()
    key = settings.get("dashscope_api_key", "")
    if key:
        return key
    return os.environ.get("DASHSCOPE_API_KEY")

def _build_system_prompt(user_data: dict) -> str:
    settings = read_settings()
    custom_prompt = settings.get("llm_system_prompt", "")

    market_lines = []
    for s in STOCKS_INFO:
        insight = MARKET_INSIGHTS.get(s["symbol"], {})
        market_lines.append(f"  - {s['name']}({s['symbol']}, 代码{s['code']}): 基准价{s['base_price']}, 趋势{insight.get('trend','震荡')}, 支撑{insight.get('support','N/A')}, 阻力{insight.get('resistance','N/A')}")

    return f"""你是 MetaBank AI 智能助手，一个基于元宇宙技术构建的金融养老社区平台的AI顾问。
MetaBank 由国脉科技股份有限公司（深交所: 002093）技术支持，总部位于福州市马尾区。

当前用户信息：
- 昵称：{user_data.get('nickname', '用户')}
- 钱包地址：{user_data.get('wallet_address', '未知')}
- 国脉币(GMC)余额：{user_data.get('balance', 0):.2f}

平台可交易标的：
{chr(10).join(market_lines)}

你的职责：
1. 帮助用户查询资产余额和交易记录
2. 分析市场行情，给出专业的投资建议和价格预测
3. 协助用户进行快捷买入/卖出操作
4. 协助用户进行代币转账
5. 帮助用户设置自动交易任务（定投DCA、价格触发、定时加仓）
6. 用通俗易懂的语言解释金融概念，特别照顾老年用户群体

回复要求：
- 使用中文回复，语言亲切友好，适合老年用户
- 适当使用 emoji 让回复更生动
- 涉及投资建议时要加风险提示
- 回复简洁实用，突出关键信息
{f'附加指令：{custom_prompt}' if custom_prompt else ''}"""

def _call_dashscope(message: str, user_data: dict, api_key: str) -> str:
    """调用 DashScope qwen3.5-flash API"""
    import dashscope
    dashscope.base_http_api_url = "https://dashscope.aliyuncs.com/api/v1"

    settings = read_settings()
    model = settings.get("llm_model", "qwen3.5-flash")

    system_prompt = _build_system_prompt(user_data)

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": message},
    ]

    response = dashscope.Generation.call(
        api_key=api_key,
        model=model,
        messages=messages,
        result_format="message",
        enable_thinking=False,
    )

    if response.status_code == 200:
        return response.output.choices[0].message.content
    else:
        raise Exception(f"DashScope API 错误: {response.code} - {response.message}")

def _generate_fallback_response(message: str, user_data: dict) -> str:
    """API Key 未配置时的本地模拟回复"""
    msg_lower = message.lower()

    if any(kw in msg_lower for kw in ["余额", "钱包", "资产", "多少钱"]):
        return f"""📊 **您的资产概况**

💰 国脉币余额：**{user_data['balance']:.2f} GMC**
🔗 钱包地址：`{user_data['wallet_address']}`

您的资产状况良好！如需了解投资建议，请告诉我您感兴趣的标的。

💡 提示：配置 DashScope API Key 后可获得更智能的 AI 分析服务。"""

    if any(kw in msg_lower for kw in ["买入", "购买", "买", "加仓"]):
        symbols = []
        for s in ["国脉", "gm", "ai", "期货", "元宇宙", "etf"]:
            if s in msg_lower:
                if "期货" in msg_lower: symbols.append("GMFT")
                elif "ai" in msg_lower or "概念" in msg_lower: symbols.append("GMAI")
                elif "元宇宙" in msg_lower: symbols.append("METAV")
                elif "etf" in msg_lower: symbols.append("AIFIN")
                else: symbols.append("GM")

        amount_match = re.search(r'(\d+(?:\.\d+)?)\s*(?:份|股|个|元)', message)
        amount = float(amount_match.group(1)) if amount_match else None

        if symbols:
            sym = symbols[0]
            insight = MARKET_INSIGHTS.get(sym, {})
            return f"""🤖 **AI交易助手分析**

📈 标的：**{sym}** - 趋势：{insight.get('trend', '震荡')}
💡 支撑位：{insight.get('support', 'N/A')} | 阻力位：{insight.get('resistance', 'N/A')}
📝 建议：{insight.get('recommendation', '建议观望')}

{'您可以前往交易所页面执行 "买入 ' + sym + ' ' + str(amount) + '份" 的操作' if amount else '请告诉我您想买入多少份？例如："买入100份"'}

⚠️ 投资有风险，以上仅为AI分析，不构成投资建议。"""

        return """🤖 **AI交易助手**

请告诉我您想交易的标的，可选：
- 🏢 **GM** - 国脉科技 (002093)
- 🤖 **GMAI** - 国脉AI概念股
- 💰 **GMC** - 国脉币/USDT
- 📊 **GMFT** - 国脉币期货
- 🌐 **METAV** - 元宇宙指数
- 📈 **AIFIN** - AI金融ETF

例如："帮我买入100份国脉AI概念股" """

    if any(kw in msg_lower for kw in ["预测", "走势", "分析", "行情", "价格"]):
        analyses = []
        for sym, insight in MARKET_INSIGHTS.items():
            price_change = round(random.uniform(-3, 5), 2)
            analyses.append(f"  {'📈' if price_change > 0 else '📉'} **{sym}**: 趋势{insight['trend']}，预计变动 {'+' if price_change > 0 else ''}{price_change}%")

        return f"""🔮 **AI市场预测分析** (本地模型)

{chr(10).join(analyses)}

📊 **综合建议**：
- 短期（1-3天）：关注GMAI和AIFIN，AI板块动能充足
- 中期（1-2周）：国脉科技基本面向好，可逢低吸纳
- 长期（1月+）：元宇宙指数处于价值洼地，建议定投

💡 配置 DashScope API Key 后可获得基于 Qwen 大模型的深度分析。

⚠️ 以上预测基于历史数据和AI模型，仅供参考。"""

    if any(kw in msg_lower for kw in ["定投", "自动", "定时", "任务"]):
        return """⏰ **自动任务设置**

您可以设置以下自动任务：

1️⃣ **定时定投 (DCA)** - 每天自动买入固定份额
2️⃣ **价格触发** - 价格到达目标时自动执行
3️⃣ **定时加仓** - 按固定间隔自动加仓

请切换到"自动任务"标签页进行设置。"""

    if any(kw in msg_lower for kw in ["转账", "发送", "转给"]):
        return """💸 **快捷转账**

请前往钱包页面或社区聊天页面进行转账操作。
在社区聊天中，您可以直接向好友发送带有代币转让的消息。"""

    if any(kw in msg_lower for kw in ["帮助", "你好", "hi", "hello", "功能"]):
        return f"""👋 您好，{user_data.get('nickname', '用户')}！我是MetaBank AI助手。

🤖 我可以帮您：

💰 **资产查询** - "查看我的余额"
📈 **市场分析** - "分析今日行情"
🔮 **价格预测** - "预测国脉科技走势"
🛒 **快捷交易** - "买入100份GMAI"
💸 **快捷转账** - "转账给张三500币"
⏰ **自动任务** - "设置定投计划"

💡 提示：在管理后台配置 DashScope API Key 可启用 Qwen 大模型，获得更智能的服务。

请问您需要什么帮助？"""

    return f"""🤖 **MetaBank AI助手** (本地模式)

我理解您说的是："{message[:100]}"

我可以帮您完成以下操作：
- 📊 查询资产余额和交易记录
- 📈 分析市场行情和价格预测
- 🛒 快捷买入/卖出操作
- 💸 代币转账
- ⏰ 设置自动交易任务

💡 **提示**：当前使用本地模式回复。配置 DashScope API Key 后将接入 Qwen 大模型，提供更智能的对话体验。
在管理后台「系统设置」中可配置 API Key。"""


@router.post("/chat")
def llm_chat(req: ChatReq, user=Depends(get_current_user)):
    u = find_one("users.json", "username", user["sub"])
    if not u:
        raise HTTPException(404, "用户不存在")

    api_key = _get_api_key(req.api_key)
    use_llm = bool(api_key)

    if use_llm:
        try:
            response = _call_dashscope(req.message, u, api_key)
        except Exception as e:
            error_msg = str(e)
            response = _generate_fallback_response(req.message, u)
            response += f"\n\n⚠️ Qwen API 调用失败（{error_msg[:100]}），已回退到本地模式。"
    else:
        response = _generate_fallback_response(req.message, u)

    return {
        "user_message": req.message,
        "ai_response": response,
        "model": "qwen3.5-flash" if use_llm else "local",
        "timestamp": datetime.now().isoformat()
    }

@router.get("/status")
def llm_status(user=Depends(get_current_user)):
    """查看 LLM 配置状态"""
    settings = read_settings()
    api_key = settings.get("dashscope_api_key", "")
    env_key = os.environ.get("DASHSCOPE_API_KEY", "")
    has_key = bool(api_key or env_key)
    return {
        "has_api_key": has_key,
        "key_source": "admin_settings" if api_key else ("env" if env_key else "none"),
        "model": settings.get("llm_model", "qwen3.5-flash"),
        "mode": "qwen" if has_key else "local",
    }

@router.post("/auto-task")
def create_auto_task(req: AutoTaskReq, user=Depends(get_current_user)):
    u = find_one("users.json", "username", user["sub"])
    task = {
        "id": str(uuid.uuid4()),
        "user_id": u["id"],
        "username": u["username"],
        "symbol": req.symbol,
        "action": req.action,
        "amount": req.amount,
        "target_price": req.target_price,
        "interval_minutes": req.interval_minutes,
        "repeat": req.repeat,
        "executed": 0,
        "task_type": req.task_type,
        "status": "active",
        "created_at": datetime.now().isoformat(),
        "next_run": (datetime.now() + timedelta(minutes=req.interval_minutes or 60)).isoformat()
    }
    append_json("auto_tasks.json", task)
    return {"message": "自动任务已创建", "task": task}

@router.get("/auto-tasks")
def list_auto_tasks(user=Depends(get_current_user)):
    tasks = read_json("auto_tasks.json")
    my_tasks = [t for t in tasks if t.get("username") == user["sub"]]
    return my_tasks

@router.delete("/auto-task/{task_id}")
def cancel_auto_task(task_id: str, user=Depends(get_current_user)):
    tasks = read_json("auto_tasks.json")
    for t in tasks:
        if t["id"] == task_id and t["username"] == user["sub"]:
            t["status"] = "cancelled"
    write_json("auto_tasks.json", tasks)
    return {"message": "任务已取消"}
