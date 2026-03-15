from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from storage import read_json, append_json, find_one, update_json, write_json, read_settings
from auth_utils import get_current_user
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
import uuid, random, re, os, traceback, hashlib

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

DEFAULT_API_KEY = "sk-462e7320be3d4608bca013c7fdd6d18b"

# 工具定义：供 Qwen 模型在用户有相应需求时调用
LLM_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "get_user_balance",
            "description": "当用户想查看余额、资产、钱包、有多少钱时调用。无需参数。",
            "parameters": {"type": "object", "properties": {}, "required": []}
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_market_analysis",
            "description": "当用户想分析市场、行情、走势、预测价格时调用。",
            "parameters": {
                "type": "object",
                "properties": {
                    "symbol": {"type": "string", "description": "可选，标的代码如 GM/GMAI/GMC/GMFT/METAV/AIFIN，不传则分析全部"}
                },
                "required": []
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "buy_stock",
            "description": "当用户明确要买入、购买、加仓某标的时调用。",
            "parameters": {
                "type": "object",
                "properties": {
                    "symbol": {"type": "string", "description": "标的代码：GM/GMAI/GMC/GMFT/METAV/AIFIN"},
                    "amount": {"type": "number", "description": "买入数量（份）"}
                },
                "required": ["symbol", "amount"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "set_dca_task",
            "description": "当用户想设置定投、自动买入、定时加仓时调用。",
            "parameters": {
                "type": "object",
                "properties": {
                    "symbol": {"type": "string", "description": "标的代码：GM/GMAI/GMC/GMFT/METAV/AIFIN"},
                    "amount": {"type": "number", "description": "每次定投数量（份）"},
                    "interval_minutes": {"type": "integer", "description": "间隔分钟，默认1440即每天"},
                    "repeat": {"type": "integer", "description": "重复次数，默认5"}
                },
                "required": ["symbol", "amount"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_user_activity",
            "description": "当用户想查看某人在社区最近发了什么动态、在干嘛、最近动态时调用。例如：帮我看看老张头最近在干嘛、王阿姨发了什么、查一下李大爷的动态。",
            "parameters": {
                "type": "object",
                "properties": {
                    "nickname": {"type": "string", "description": "用户昵称，如：老张头、王阿姨、李大爷、陈奶奶等"}
                },
                "required": ["nickname"]
            }
        }
    }
]

def _get_current_price(symbol: str) -> Optional[float]:
    s = next((x for x in STOCKS_INFO if x["symbol"] == symbol), None)
    if not s:
        return None
    seed = int(hashlib.md5((symbol + datetime.now().strftime("%Y%m%d%H%M")).encode()).hexdigest()[:8], 16)
    random.seed(seed)
    fluctuation = random.gauss(0, 0.03)
    random.seed()
    return round(s["base_price"] * (1 + fluctuation), 4)

def _execute_tool(name: str, arguments: dict, user_data: dict) -> Dict[str, Any]:
    """执行工具并返回结果，供前端显著展示"""
    try:
        if name == "get_user_balance":
            return {
                "tool": "get_user_balance",
                "label": "💰 余额查询",
                "success": True,
                "data": {
                    "balance": user_data.get("balance", 0),
                    "wallet_address": user_data.get("wallet_address", ""),
                    "nickname": user_data.get("nickname", "用户")
                },
                "summary": f"国脉币余额：{user_data.get('balance', 0):.2f} GMC"
            }
        if name == "get_market_analysis":
            symbol = arguments.get("symbol", "").upper() or None
            symbols = [s["symbol"] for s in STOCKS_INFO] if not symbol else ([symbol] if symbol in [x["symbol"] for x in STOCKS_INFO] else [s["symbol"] for s in STOCKS_INFO])
            items = []
            for sym in symbols:
                insight = MARKET_INSIGHTS.get(sym, {})
                s = next((x for x in STOCKS_INFO if x["symbol"] == sym), None)
                if s:
                    price = _get_current_price(sym)
                    items.append({
                        "symbol": sym,
                        "name": s["name"],
                        "price": price,
                        "trend": insight.get("trend", "震荡"),
                        "support": insight.get("support"),
                        "resistance": insight.get("resistance"),
                        "recommendation": insight.get("recommendation", "")
                    })
            return {
                "tool": "get_market_analysis",
                "label": "📈 市场分析",
                "success": True,
                "data": {"items": items},
                "summary": f"已分析 {len(items)} 个标的行情"
            }
        if name == "buy_stock":
            symbol = (arguments.get("symbol") or "").upper()
            amount = float(arguments.get("amount", 0))
            s = next((x for x in STOCKS_INFO if x["symbol"] == symbol), None)
            if not s or amount <= 0:
                return {"tool": "buy_stock", "label": "🛒 买入操作", "success": False, "error": "参数无效"}
            price = _get_current_price(symbol)
            total_cost = price * amount
            u = find_one("users.json", "id", user_data["id"])
            if u["balance"] < total_cost:
                return {"tool": "buy_stock", "label": "🛒 买入操作", "success": False, "error": f"余额不足，需要 {total_cost:.2f} GMC"}
            update_json("users.json", "id", u["id"], {"balance": round(u["balance"] - total_cost, 4)})
            trade_record = {
                "id": str(uuid.uuid4()),
                "user_id": u["id"], "username": u["username"],
                "symbol": symbol, "name": s["name"], "action": "buy",
                "amount": amount, "price": price, "total": total_cost,
                "created_at": datetime.now().isoformat()
            }
            market = read_json("market.json")
            market.append(trade_record)
            write_json("market.json", market)
            txn = {
                "id": str(uuid.uuid4()), "type": "trade",
                "from_address": u["wallet_address"], "from_name": u["nickname"],
                "to_address": "0xGM_EXCHANGE", "to_name": "MetaBank交易所",
                "amount": total_cost,
                "note": f"买入 {s['name']} {amount}份 @{price}",
                "created_at": datetime.now().isoformat()
            }
            append_json("transactions.json", txn)
            new_balance = round(u["balance"] - total_cost, 4)
            return {
                "tool": "buy_stock",
                "label": "🛒 买入成功",
                "success": True,
                "data": {
                    "symbol": symbol,
                    "name": s["name"],
                    "amount": amount,
                    "price": price,
                    "total_cost": total_cost,
                    "new_balance": new_balance
                },
                "summary": f"已买入 {s['name']} {amount}份，消耗 {total_cost:.2f} GMC"
            }
        if name == "set_dca_task":
            symbol = (arguments.get("symbol") or "").upper()
            amount = float(arguments.get("amount", 0))
            interval = int(arguments.get("interval_minutes", 1440))
            repeat = int(arguments.get("repeat", 5))
            s = next((x for x in STOCKS_INFO if x["symbol"] == symbol), None)
            if not s or amount <= 0:
                return {"tool": "set_dca_task", "label": "⏰ 设置定投", "success": False, "error": "参数无效"}
            task = {
                "id": str(uuid.uuid4()),
                "user_id": user_data["id"],
                "username": user_data["username"],
                "symbol": symbol, "action": "buy", "amount": amount,
                "target_price": None, "interval_minutes": interval, "repeat": repeat,
                "executed": 0, "task_type": "dca", "status": "active",
                "created_at": datetime.now().isoformat(),
                "next_run": (datetime.now() + timedelta(minutes=interval)).isoformat()
            }
            append_json("auto_tasks.json", task)
            return {
                "tool": "set_dca_task",
                "label": "⏰ 定投已设置",
                "success": True,
                "data": {
                    "symbol": symbol,
                    "name": s["name"],
                    "amount": amount,
                    "interval_minutes": interval,
                    "repeat": repeat,
                    "task_id": task["id"]
                },
                "summary": f"已设置每{interval}分钟定投{s['name']} {amount}份，共{repeat}次"
            }
        if name == "get_user_activity":
            nickname = (arguments.get("nickname") or "").strip()
            if not nickname:
                return {"tool": "get_user_activity", "label": "👀 用户动态查询", "success": False, "error": "请提供用户昵称"}
            try:
                posts = read_json("community_posts.json")
            except Exception:
                posts = []
            matched = [p for p in posts if nickname in (p.get("nickname") or "")]
            matched.sort(key=lambda x: x.get("created_at", ""), reverse=True)
            items = []
            for p in matched[:15]:
                extra = p.get("extra") or {}
                item = {
                    "type": p.get("type", "life"),
                    "content": p.get("content", ""),
                    "created_at": p.get("created_at", ""),
                }
                if p.get("type") == "sport" and extra.get("gmc_earned"):
                    item["gmc_earned"] = extra["gmc_earned"]
                if p.get("type") == "shop" and extra.get("product"):
                    item["product"] = extra.get("product", "")
                    item["price"] = extra.get("price", 0)
                if p.get("type") == "trade" and extra.get("symbol"):
                    item["symbol"] = extra.get("symbol", "")
                    item["amount"] = extra.get("amount", 0)
                    item["action"] = extra.get("action", "buy")
                items.append(item)
            return {
                "tool": "get_user_activity",
                "label": "👀 用户动态查询",
                "success": True,
                "data": {
                    "nickname": nickname,
                    "posts": items,
                    "total": len(matched)
                },
                "summary": f"已查询到 {nickname} 的 {len(items)} 条最近动态"
            }
    except Exception as e:
        return {"tool": name, "label": "工具执行", "success": False, "error": str(e)}
    return {"tool": name, "label": "未知工具", "success": False, "error": "未知工具"}

def _get_api_key(user_key: Optional[str] = None) -> Optional[str]:
    if user_key:
        return user_key
    settings = read_settings()
    key = settings.get("dashscope_api_key", "")
    if key:
        return key
    return os.environ.get("DASHSCOPE_API_KEY") or DEFAULT_API_KEY

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

【货币单位重要】平台内所有金额均为 国脉币(GMC)，是平台虚拟代币，不是人民币(CNY/元/RMB)。提及金额时务必明确写「GMC」或「国脉币」，严禁与人民币混淆。

重要：当用户明确要求以下操作时，你必须调用对应工具获取真实数据后再回复。工具执行结果会在对话框内显著展示，你只需基于结果做简要解读和总结。
- 查看余额、资产 → get_user_balance
- 市场分析、行情 → get_market_analysis
- 买入/卖出标的 → buy_stock
- 设置定投 → set_dca_task
- 查看某人最近在干嘛、发了什么动态、社区动态 → get_user_activity（参数：nickname，如老张头、王阿姨）
{f'附加指令：{custom_prompt}' if custom_prompt else ''}"""

def _call_dashscope(message: str, user_data: dict, api_key: str):
    """调用 DashScope API，支持工具调用，返回 (回复文本, 工具调用列表)"""
    from openai import OpenAI
    import json

    client = OpenAI(
        api_key=api_key,
        base_url="https://dashscope.aliyuncs.com/compatible-mode/v1",
    )

    settings = read_settings()
    model = settings.get("llm_model", "qwen3.5-flash")

    system_prompt = _build_system_prompt(user_data)

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": message},
    ]

    tool_calls_log: List[Dict[str, Any]] = []
    max_tool_rounds = 5

    for _ in range(max_tool_rounds):
        completion = client.chat.completions.create(
            model=model,
            messages=messages,
            tools=LLM_TOOLS,
            extra_body={"enable_thinking": False},
        )

        msg = completion.choices[0].message

        if not msg.tool_calls:
            return (msg.content or ""), tool_calls_log

        tool_messages = []
        assistant_tool_calls = []

        for tc in msg.tool_calls:
            fid = getattr(tc, "id", None) or str(uuid.uuid4())
            fn = getattr(tc, "function", tc) if hasattr(tc, "function") else tc
            name = getattr(fn, "name", "") or (fn.get("name", "") if isinstance(fn, dict) else "")
            args_str = getattr(fn, "arguments", "") or (fn.get("arguments", "{}") if isinstance(fn, dict) else "{}")
            try:
                args = json.loads(args_str) if isinstance(args_str, str) else (args_str or {})
            except json.JSONDecodeError:
                args = {}

            result = _execute_tool(name, args, user_data)
            tool_calls_log.append({"name": name, "arguments": args, "result": result})

            tool_messages.append({
                "role": "tool",
                "tool_call_id": fid,
                "content": json.dumps(result, ensure_ascii=False),
            })
            assistant_tool_calls.append({
                "id": fid,
                "type": "function",
                "function": {"name": name, "arguments": args_str if isinstance(args_str, str) else json.dumps(args_str)},
            })

        messages.append({
            "role": "assistant",
            "content": msg.content or None,
            "tool_calls": assistant_tool_calls,
        })
        messages.extend(tool_messages)

    return ("工具调用次数过多，请简化请求后重试。", tool_calls_log)

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
    tool_calls: List[Dict[str, Any]] = []

    if use_llm:
        try:
            response, tool_calls = _call_dashscope(req.message, u, api_key)
        except Exception as e:
            error_msg = str(e)
            response = _generate_fallback_response(req.message, u)
            response += f"\n\n⚠️ Qwen API 调用失败（{error_msg[:100]}），已回退到本地模式。"
    else:
        response = _generate_fallback_response(req.message, u)
        msg_lower = req.message.lower()
        # 本地模式：根据关键词直接执行工具，结果在对话框内显著展示
        if any(kw in msg_lower for kw in ["余额", "钱包", "资产", "多少钱"]):
            res = _execute_tool("get_user_balance", {}, u)
            tool_calls = [{"name": "get_user_balance", "arguments": {}, "result": res}]
        elif any(kw in msg_lower for kw in ["分析", "行情", "走势", "预测", "价格"]):
            sym = ""
            for s, code in [("gmai", "GMAI"), ("国脉科技", "GM"), ("gm ", "GM"), ("期货", "GMFT"), ("元宇宙", "METAV"), ("etf", "AIFIN"), ("gmc", "GMC")]:
                if s in msg_lower or s in req.message:
                    sym = code
                    break
            res = _execute_tool("get_market_analysis", {"symbol": sym}, u)
            tool_calls = [{"name": "get_market_analysis", "arguments": {"symbol": sym}, "result": res}]
        elif any(kw in msg_lower for kw in ["买入", "购买", "买", "加仓"]):
            amount_match = re.search(r'(\d+(?:\.\d+)?)\s*(?:份|股|个)?', req.message)
            amount = float(amount_match.group(1)) if amount_match else 0
            sym = "GMAI"
            for s, code in [("国脉科技", "GM"), ("ai", "GMAI"), ("概念", "GMAI"), ("期货", "GMFT"), ("元宇宙", "METAV"), ("etf", "AIFIN")]:
                if s in msg_lower or s in req.message:
                    sym = code
                    break
            if amount > 0:
                res = _execute_tool("buy_stock", {"symbol": sym, "amount": amount}, u)
                tool_calls = [{"name": "buy_stock", "arguments": {"symbol": sym, "amount": amount}, "result": res}]
                if res.get("success"):
                    response = f"✅ **{res.get('label', '买入成功')}**\n\n{res.get('summary', '')}\n\n⚠️ 投资有风险，以上为实际执行结果。"
        elif any(kw in msg_lower for kw in ["定投", "自动", "定时"]):
            amount_match = re.search(r'(\d+(?:\.\d+)?)\s*(?:份|股)?', req.message)
            amount = float(amount_match.group(1)) if amount_match else 50
            sym = "GMAI"
            for s, code in [("国脉科技", "GM"), ("ai", "GMAI"), ("概念", "GMAI"), ("期货", "GMFT"), ("元宇宙", "METAV"), ("etf", "AIFIN")]:
                if s in msg_lower or s in req.message:
                    sym = code
                    break
            res = _execute_tool("set_dca_task", {"symbol": sym, "amount": amount, "interval_minutes": 1440, "repeat": 5}, u)
            tool_calls = [{"name": "set_dca_task", "arguments": {"symbol": sym, "amount": amount}, "result": res}]
            if res.get("success"):
                response = f"✅ **{res.get('label', '定投已设置')}**\n\n{res.get('summary', '')}\n\n请在「自动任务」标签页查看和管理。"
        elif any(kw in req.message for kw in ["在干嘛", "最近", "动态", "发了什么", "看看", "查一下", "关注"]):
            nicknames = ["老张头", "王阿姨", "李大爷", "陈奶奶", "刘叔", "赵婶", "孙伯伯", "周阿姨", "吴爷爷", "郑奶奶", "钱叔", "老林", "黄阿姨", "何大爷", "老罗", "高奶奶", "退休老王", "幸福老李", "健康张姐", "快乐陈叔", "阳光刘姨", "悠然赵伯"]
            nickname = ""
            for n in nicknames:
                if n in req.message:
                    nickname = n
                    break
            if not nickname and re.search(r"[看查]?(一下)?\s*(\S{2,4})\s*(最近|在干嘛|动态)", req.message):
                m = re.search(r"[看查]?(一下)?\s*(\S{2,4})\s*(最近|在干嘛|动态)", req.message)
                if m:
                    nickname = m.group(2)
            if nickname:
                res = _execute_tool("get_user_activity", {"nickname": nickname}, u)
                tool_calls = [{"name": "get_user_activity", "arguments": {"nickname": nickname}, "result": res}]
                if res.get("success") and res.get("data", {}).get("posts"):
                    response = f"✅ **{res.get('label', '用户动态查询')}**\n\n已查询到 {nickname} 的最近动态，详见上方工具展示。请基于这些动态为用户做简要总结。"
                elif res.get("success"):
                    response = f"✅ **{res.get('label', '用户动态查询')}**\n\n{nickname} 暂无社区动态记录。"

    return {
        "user_message": req.message,
        "ai_response": response,
        "model": read_settings().get("llm_model", "qwen3.5-flash") if use_llm else "local",
        "tool_calls": tool_calls,
        "timestamp": datetime.now().isoformat()
    }

@router.get("/status")
def llm_status(user=Depends(get_current_user)):
    """查看 LLM 配置状态"""
    settings = read_settings()
    api_key = settings.get("dashscope_api_key", "")
    env_key = os.environ.get("DASHSCOPE_API_KEY", "")
    has_key = bool(api_key or env_key or DEFAULT_API_KEY)
    return {
        "has_api_key": has_key,
        "key_source": "admin_settings" if api_key else ("env" if env_key else "default"),
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
