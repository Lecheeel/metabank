from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from storage import read_json, write_json, find_one, update_json, append_json
from auth_utils import get_current_user
from datetime import datetime, timedelta
from typing import Optional
import uuid, random, math, hashlib

router = APIRouter()

STOCKS = [
    {"symbol": "GM", "name": "国脉科技", "code": "002093", "base_price": 12.5, "category": "stock", "description": "国脉科技股份有限公司 - 物联网技术服务"},
    {"symbol": "GMAI", "name": "国脉AI概念", "code": "GM-AI", "base_price": 25.0, "category": "ai_stock", "description": "国脉科技AI概念板块"},
    {"symbol": "GMC", "name": "国脉币/USDT", "code": "GMC-USDT", "base_price": 1.0, "category": "crypto", "description": "国脉币兑USDT交易对"},
    {"symbol": "GMFT", "name": "国脉币期货", "code": "GMC-FT", "base_price": 1.05, "category": "futures", "description": "国脉币期货合约"},
    {"symbol": "METAV", "name": "元宇宙指数", "code": "META-IDX", "base_price": 100.0, "category": "index", "description": "MetaBank元宇宙概念指数"},
    {"symbol": "AIFIN", "name": "AI金融ETF", "code": "AI-FIN", "base_price": 50.0, "category": "ai_stock", "description": "AI金融科技ETF基金"},
]

def _generate_kline(base_price, days=90):
    data = []
    price = base_price
    now = datetime.now()
    for i in range(days, 0, -1):
        dt = now - timedelta(days=i)
        change = random.gauss(0, 0.02) * price
        open_p = price
        close_p = price + change
        high = max(open_p, close_p) * (1 + random.random() * 0.015)
        low = min(open_p, close_p) * (1 - random.random() * 0.015)
        volume = random.randint(10000, 500000)
        data.append({
            "date": dt.strftime("%Y-%m-%d"),
            "open": round(open_p, 4),
            "close": round(close_p, 4),
            "high": round(high, 4),
            "low": round(low, 4),
            "volume": volume
        })
        price = close_p
    return data

def _get_current_price(symbol):
    s = next((s for s in STOCKS if s["symbol"] == symbol), None)
    if not s:
        return None
    seed = int(hashlib.md5((symbol + datetime.now().strftime("%Y%m%d%H%M")).encode()).hexdigest()[:8], 16)
    random.seed(seed)
    fluctuation = random.gauss(0, 0.03)
    random.seed()
    price = s["base_price"] * (1 + fluctuation)
    return round(price, 4)

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
    return {"symbol": symbol, "name": s["name"], "data": _generate_kline(s["base_price"], days)}

@router.post("/trade")
def trade(req: TradeReq, user=Depends(get_current_user)):
    s = next((s for s in STOCKS if s["symbol"] == req.symbol), None)
    if not s:
        raise HTTPException(404, "标的不存在")

    price = req.price or _get_current_price(req.symbol)
    total_cost = price * req.amount
    buyer = find_one("users.json", "username", user["sub"])

    if req.action == "buy":
        if buyer["balance"] < total_cost:
            raise HTTPException(400, "国脉币余额不足")
        update_json("users.json", "id", buyer["id"], {"balance": round(buyer["balance"] - total_cost, 4)})
    elif req.action == "sell":
        holdings = _get_holdings(buyer["id"], req.symbol)
        if holdings < req.amount:
            raise HTTPException(400, "持仓不足")
        update_json("users.json", "id", buyer["id"], {"balance": round(buyer["balance"] + total_cost, 4)})
    else:
        raise HTTPException(400, "无效的交易类型")

    trade_record = {
        "id": str(uuid.uuid4()),
        "user_id": buyer["id"],
        "username": buyer["username"],
        "symbol": req.symbol,
        "name": s["name"],
        "action": req.action,
        "amount": req.amount,
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
        "from_address": buyer["wallet_address"] if req.action == "buy" else "0xGM_EXCHANGE",
        "from_name": buyer["nickname"] if req.action == "buy" else "MetaBank交易所",
        "to_address": "0xGM_EXCHANGE" if req.action == "buy" else buyer["wallet_address"],
        "to_name": "MetaBank交易所" if req.action == "buy" else buyer["nickname"],
        "amount": total_cost,
        "note": f"{'买入' if req.action == 'buy' else '卖出'} {s['name']} {req.amount}份 @{price}",
        "created_at": datetime.now().isoformat()
    }
    append_json("transactions.json", txn)

    return {
        "message": f"{'买入' if req.action == 'buy' else '卖出'}成功",
        "trade": trade_record,
        "new_balance": round(buyer["balance"] + (-total_cost if req.action == "buy" else total_cost), 4)
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
