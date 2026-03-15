from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from storage import read_json, append_json, find_one, update_json, write_json
from auth_utils import get_current_user
from datetime import datetime, timedelta
from typing import Optional
import uuid, random, re

router = APIRouter()

class ChatReq(BaseModel):
    message: str

class AutoTaskReq(BaseModel):
    symbol: str
    action: str  # buy / sell
    amount: float
    target_price: Optional[float] = None
    interval_minutes: Optional[int] = None
    repeat: int = 1
    task_type: str = "price_trigger"  # price_trigger / timed / dca

MARKET_INSIGHTS = {
    "GM": {"trend": "看涨", "support": 11.5, "resistance": 14.0, "recommendation": "建议适量买入，国脉科技物联网业务持续增长"},
    "GMAI": {"trend": "强势看涨", "support": 22.0, "resistance": 30.0, "recommendation": "AI概念持续火热，建议分批建仓"},
    "GMC": {"trend": "震荡", "support": 0.9, "resistance": 1.15, "recommendation": "国脉币价格相对稳定，适合长期持有"},
    "GMFT": {"trend": "看涨", "support": 1.0, "resistance": 1.2, "recommendation": "期货合约溢价合理，可适量做多"},
    "METAV": {"trend": "看涨", "support": 90.0, "resistance": 120.0, "recommendation": "元宇宙概念回暖，指数有上行空间"},
    "AIFIN": {"trend": "强势", "support": 45.0, "resistance": 60.0, "recommendation": "AI金融ETF近期表现强劲，建议持有"},
}

def _generate_llm_response(message: str, user_data: dict) -> str:
    msg_lower = message.lower()

    if any(kw in msg_lower for kw in ["余额", "钱包", "资产", "多少钱"]):
        return f"""📊 **您的资产概况**

💰 国脉币余额：**{user_data['balance']:.2f} GMC**
🔗 钱包地址：`{user_data['wallet_address']}`

您的资产状况良好！如需了解投资建议，请告诉我您感兴趣的标的。"""

    if any(kw in msg_lower for kw in ["买入", "购买", "买", "加仓"]):
        symbols = []
        for s in ["国脉", "gm", "ai", "期货", "元宇宙", "etf"]:
            if s in msg_lower:
                if "期货" in msg_lower:
                    symbols.append("GMFT")
                elif "ai" in msg_lower or "概念" in msg_lower:
                    symbols.append("GMAI")
                elif "元宇宙" in msg_lower:
                    symbols.append("METAV")
                elif "etf" in msg_lower:
                    symbols.append("AIFIN")
                else:
                    symbols.append("GM")

        amount_match = re.search(r'(\d+(?:\.\d+)?)\s*(?:份|股|个|元)', message)
        amount = float(amount_match.group(1)) if amount_match else None

        if symbols:
            sym = symbols[0]
            insight = MARKET_INSIGHTS.get(sym, {})
            return f"""🤖 **AI交易助手分析**

📈 标的：**{sym}** - 趋势：{insight.get('trend', '震荡')}
💡 支撑位：{insight.get('support', 'N/A')} | 阻力位：{insight.get('resistance', 'N/A')}
📝 建议：{insight.get('recommendation', '建议观望')}

{'您可以说"确认买入 ' + sym + ' ' + str(amount) + '份"来执行交易' if amount else '请告诉我您想买入多少份？例如："买入100份"'}

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

        return f"""🔮 **AI市场预测分析** (基于多因子模型)

{chr(10).join(analyses)}

📊 **综合建议**：
- 短期（1-3天）：关注GMAI和AIFIN，AI板块动能充足
- 中期（1-2周）：国脉科技基本面向好，可逢低吸纳
- 长期（1月+）：元宇宙指数处于价值洼地，建议定投

💡 推荐策略：DCA定投国脉AI概念股，每日自动买入
输入"设置定投 GMAI 每天 50份"即可开启自动定投

⚠️ 以上预测基于历史数据和AI模型，仅供参考。"""

    if any(kw in msg_lower for kw in ["定投", "自动", "定时", "任务"]):
        return """⏰ **自动任务设置**

您可以设置以下自动任务：

1️⃣ **定时定投 (DCA)**
   示例："设置定投 GMAI 每天 50份"
   每天自动买入固定份额

2️⃣ **价格触发**
   示例："当GM跌到11.5时买入200份"
   价格到达目标时自动执行

3️⃣ **定时加仓**
   示例："每小时加仓 GMC 10份"
   按固定间隔自动加仓

请告诉我您想设置哪种自动任务？"""

    if any(kw in msg_lower for kw in ["转账", "发送", "转给"]):
        return """💸 **快捷转账**

请提供以下信息：
- 接收方（用户名或钱包地址）
- 转账金额（国脉币）

示例："转账给 zhangsan 500国脉币"

我将帮您快速完成转账操作。"""

    if any(kw in msg_lower for kw in ["帮助", "你好", "hi", "hello", "功能"]):
        return f"""👋 您好，{user_data.get('nickname', '用户')}！我是MetaBank AI助手。

🤖 我可以帮您：

💰 **资产查询** - "查看我的余额"
📈 **市场分析** - "分析今日行情"
🔮 **价格预测** - "预测国脉科技走势"
🛒 **快捷交易** - "买入100份GMAI"
💸 **快捷转账** - "转账给张三500币"
⏰ **自动任务** - "设置定投计划"
📊 **持仓查看** - "查看我的持仓"

请问您需要什么帮助？"""

    return f"""🤖 **MetaBank AI助手**

感谢您的消息！我理解您说的是："{message[:100]}"

我可以帮您完成以下操作：
- 📊 查询资产余额和交易记录
- 📈 分析市场行情和价格预测
- 🛒 快捷买入/卖出操作
- 💸 代币转账
- ⏰ 设置自动交易任务

请试着用更具体的方式描述您的需求，例如：
- "帮我分析国脉科技的走势"
- "买入50份AI概念股"
- "设置每天定投GMAI 100份"
"""

@router.post("/chat")
def llm_chat(req: ChatReq, user=Depends(get_current_user)):
    u = find_one("users.json", "username", user["sub"])
    if not u:
        raise HTTPException(404, "用户不存在")

    response = _generate_llm_response(req.message, u)

    return {
        "user_message": req.message,
        "ai_response": response,
        "timestamp": datetime.now().isoformat()
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
