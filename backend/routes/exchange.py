from fastapi import APIRouter, HTTPException, Depends, WebSocket, WebSocketDisconnect
from pydantic import BaseModel
from storage import read_json, write_json, find_one, update_json, append_json
from auth_utils import get_current_user
from datetime import datetime
from typing import Optional
import uuid, asyncio
from . import market_model
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
import guardian_utils

router = APIRouter()

STOCKS = [
    {"symbol": "GM", "name": "国脉科技", "code": "002093", "base_price": 12.5, "category": "stock", "description": "国脉科技股份有限公司 - 物联网技术服务"},
    {"symbol": "GMAI", "name": "国脉AI概念", "code": "GM-AI", "base_price": 25.0, "category": "ai_stock", "description": "国脉科技AI概念板块"},
    {"symbol": "GMC", "name": "国脉币/USDT", "code": "GMC-USDT", "base_price": 1.0, "category": "crypto", "description": "国脉币兑USDT交易对"},
    {"symbol": "GMFT", "name": "国脉币期货", "code": "GMC-FT", "base_price": 1.05, "category": "futures", "description": "国脉币期货合约"},
    {"symbol": "METAV", "name": "元宇宙指数", "code": "META-IDX", "base_price": 100.0, "category": "index", "description": "MetaBank元宇宙概念指数"},
    {"symbol": "AIFIN", "name": "AI金融ETF", "code": "AI-FIN", "base_price": 50.0, "category": "ai_stock", "description": "AI金融科技ETF基金"},
]

def _generate_kline(symbol, days=90):
    return market_model.simulate_price_path(symbol, days=days)

def _get_current_price(symbol):
    return market_model.get_current_price(symbol)

class TradeReq(BaseModel):
    symbol: str
    action: str  # buy / sell
    amount: float
    price: Optional[float] = None

class PositionInfo(BaseModel):
    symbol: str

@router.get("/stocks")
def list_stocks():
    result = []
    for s in STOCKS:
        price = _get_current_price(s["symbol"])
        change = round((price - s["base_price"]) / s["base_price"] * 100, 2)
        result.append({**s, "current_price": price, "change_percent": change})
    return result

@router.get("/kline/{symbol}")
def get_kline(symbol: str, days: int = 90):
    s = next((s for s in STOCKS if s["symbol"] == symbol), None)
    if not s:
        raise HTTPException(404, "标的不存在")
    return {"symbol": symbol, "name": s["name"], "data": _generate_kline(symbol, days)}

@router.post("/trade")
def trade(req: TradeReq, user=Depends(get_current_user)):
    s = next((s for s in STOCKS if s["symbol"] == req.symbol), None)
    if not s:
        raise HTTPException(404, "标的不存在")

    price = req.price or _get_current_price(req.symbol)
    total_cost = round(price * req.amount, 4)
    buyer = find_one("users.json", "username", user["sub"])

    # 监护拦截
    if guardian_utils.check_needs_approval(buyer, total_cost):
        approval = guardian_utils.create_pending_approval(
            buyer, "trade",
            {"symbol": req.symbol, "action": req.action, "amount": req.amount, "price": price},
            total_cost,
        )
        return {
            "status": "pending_approval",
            "approval_id": approval["id"],
            "message": f"交易金额 {total_cost} GMC 超过大额阈值，已通知监护人审批",
        }

    return _do_trade(buyer, req.symbol, req.action, req.amount, price)


def _do_trade(buyer: dict, symbol: str, action: str, amount: float, price: float) -> dict:
    """执行实际交易（供直接调用与审批后回调）。"""
    s = next((s for s in STOCKS if s["symbol"] == symbol), None)
    if not s:
        raise HTTPException(404, "标的不存在")
    total_cost = round(price * amount, 4)

    if action == "buy":
        if buyer["balance"] < total_cost:
            raise HTTPException(400, "国脉币余额不足")
        update_json("users.json", "id", buyer["id"], {"balance": round(buyer["balance"] - total_cost, 4)})
    elif action == "sell":
        holdings = _get_holdings(buyer["id"], symbol)
        if holdings < amount:
            raise HTTPException(400, "持仓不足")
        update_json("users.json", "id", buyer["id"], {"balance": round(buyer["balance"] + total_cost, 4)})
    else:
        raise HTTPException(400, "无效的交易类型")

    trade_record = {
        "id": str(uuid.uuid4()),
        "user_id": buyer["id"],
        "username": buyer["username"],
        "symbol": symbol,
        "name": s["name"],
        "action": action,
        "amount": amount,
        "price": price,
        "total": total_cost,
        "created_at": datetime.now().isoformat()
    }
    market = read_json("market.json")
    market.append(trade_record)
    write_json("market.json", market)

    txn = {
        "id": str(uuid.uuid4()),
        "type": "trade",
        "from_address": buyer["wallet_address"] if action == "buy" else "0xGM_EXCHANGE",
        "from_name": buyer["nickname"] if action == "buy" else "MetaBank交易所",
        "to_address": "0xGM_EXCHANGE" if action == "buy" else buyer["wallet_address"],
        "to_name": "MetaBank交易所" if action == "buy" else buyer["nickname"],
        "amount": total_cost,
        "note": f"{'买入' if action == 'buy' else '卖出'} {s['name']} {amount}份 @{price}",
        "created_at": datetime.now().isoformat()
    }
    append_json("transactions.json", txn)

    return {
        "message": f"{'买入' if action == 'buy' else '卖出'}成功",
        "trade": trade_record,
        "new_balance": round(buyer["balance"] + (-total_cost if action == "buy" else total_cost), 4)
    }

def _get_holdings(user_id, symbol):
    market = read_json("market.json")
    user_trades = [t for t in market if t["user_id"] == user_id and t["symbol"] == symbol]
    total = 0
    for t in user_trades:
        if t["action"] == "buy":
            total += t["amount"]
        else:
            total -= t["amount"]
    return max(total, 0)

@router.get("/portfolio")
def portfolio(user=Depends(get_current_user)):
    buyer = find_one("users.json", "username", user["sub"])
    market = read_json("market.json")
    user_trades = [t for t in market if t["user_id"] == buyer["id"]]

    symbols = set(t["symbol"] for t in user_trades)
    positions = []
    for sym in symbols:
        trades = [t for t in user_trades if t["symbol"] == sym]
        total_amount = 0
        total_cost = 0
        for t in trades:
            if t["action"] == "buy":
                total_amount += t["amount"]
                total_cost += t["total"]
            else:
                total_amount -= t["amount"]
                total_cost -= t["total"]
        if total_amount > 0:
            avg_cost = total_cost / total_amount if total_amount > 0 else 0
            current_price = _get_current_price(sym)
            s = next((s for s in STOCKS if s["symbol"] == sym), {})
            positions.append({
                "symbol": sym,
                "name": s.get("name", sym),
                "amount": round(total_amount, 4),
                "avg_cost": round(avg_cost, 4),
                "current_price": current_price,
                "market_value": round(total_amount * current_price, 4),
                "profit": round(total_amount * (current_price - avg_cost), 4),
                "profit_percent": round((current_price - avg_cost) / avg_cost * 100, 2) if avg_cost > 0 else 0
            })

    return {"positions": positions, "balance": buyer["balance"]}

@router.get("/history")
def trade_history(user=Depends(get_current_user)):
    buyer = find_one("users.json", "username", user["sub"])
    market = read_json("market.json")
    user_trades = [t for t in market if t["user_id"] == buyer["id"]]
    user_trades.sort(key=lambda x: x.get("created_at", ""), reverse=True)
    return user_trades[:100]


@router.get("/macro")
def get_macro():
    """返回当前宏观因子快照（CPI / AI 热度 / 黄金溢价 / 市场情绪）。"""
    return market_model.get_macro_factors()


@router.get("/asset_profiles")
def get_asset_profiles():
    """返回各标的的差异化参数（μ_base, σ, λ, β 系数等），供前端/文档展示。"""
    return [
        {
            "symbol": p.symbol,
            "base_price": p.base_price,
            "mu_base": p.mu_base,
            "sigma": p.sigma,
            "jump_lambda": p.jump_lambda,
            "beta_cpi": p.beta_cpi,
            "beta_ai": p.beta_ai,
            "beta_gold": p.beta_gold,
            "beta_sentiment": p.beta_sentiment,
        }
        for p in market_model.list_asset_profiles()
    ]


@router.websocket("/ws/macro")
async def ws_macro(ws: WebSocket):
    """每 5 秒推送一次宏观因子快照。"""
    await ws.accept()
    try:
        while True:
            await ws.send_json(market_model.get_macro_factors())
            await asyncio.sleep(5)
    except WebSocketDisconnect:
        return
    except Exception:
        return
