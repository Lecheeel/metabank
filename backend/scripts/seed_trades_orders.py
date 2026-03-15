"""生成假交易和订单数据"""
import json
import os
import uuid
import random
from datetime import datetime, timedelta

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data")

STOCKS = [
    {"symbol": "GM", "name": "国脉科技", "base_price": 12.5},
    {"symbol": "GMAI", "name": "国脉AI概念", "base_price": 25.0},
    {"symbol": "GMC", "name": "国脉币/USDT", "base_price": 1.0},
    {"symbol": "GMFT", "name": "国脉币期货", "base_price": 1.05},
    {"symbol": "METAV", "name": "元宇宙指数", "base_price": 100.0},
    {"symbol": "AIFIN", "name": "AI金融ETF", "base_price": 50.0},
]

def _read(name):
    p = os.path.join(DATA_DIR, name)
    if os.path.exists(p):
        with open(p, "r", encoding="utf-8") as f:
            return json.load(f)
    return []

def _write(name, data):
    with open(os.path.join(DATA_DIR, name), "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

def main():
    users = _read("users.json")
    products = _read("products.json")
    market = _read("market.json")
    transactions = _read("transactions.json")
    orders = _read("orders.json")

    # 排除 admin，选普通用户
    normal_users = [u for u in users if not u.get("is_admin") and u.get("wallet_address")]
    if len(normal_users) < 3:
        print("用户不足，请先运行 seed_fake_users.py")
        return

    base = datetime(2026, 3, 10, 9, 0, 0)

    # 1. 生成交易所交易 (market + transactions)
    for i in range(80):
        u = random.choice(normal_users)
        s = random.choice(STOCKS)
        price = round(s["base_price"] * (1 + random.uniform(-0.05, 0.08)), 4)
        amount = random.choice([10, 20, 50, 100, 30, 80, 15])
        total = round(price * amount, 4)
        action = random.choice(["buy", "buy", "buy", "sell"])
        t = base + timedelta(hours=i * 2, minutes=random.randint(0, 59))
        ts = t.isoformat()

        trade = {
            "id": str(uuid.uuid4()),
            "user_id": u["id"],
            "username": u["username"],
            "symbol": s["symbol"],
            "name": s["name"],
            "action": action,
            "amount": amount,
            "price": price,
            "total": total,
            "created_at": ts,
        }
        market.append(trade)

        txn = {
            "id": str(uuid.uuid4()),
            "type": "trade",
            "from_address": u["wallet_address"] if action == "buy" else "0xGM_EXCHANGE",
            "from_name": u["nickname"] if action == "buy" else "MetaBank交易所",
            "to_address": "0xGM_EXCHANGE" if action == "buy" else u["wallet_address"],
            "to_name": "MetaBank交易所" if action == "buy" else u["nickname"],
            "amount": total,
            "note": f"{'买入' if action == 'buy' else '卖出'} {s['name']} {amount}份 @{price}",
            "created_at": ts,
        }
        transactions.append(txn)

    # 2. 生成商城订单 (orders + transactions)
    for i in range(50):
        u = random.choice(normal_users)
        p = random.choice(products)
        qty = random.choice([1, 1, 1, 2, 3])
        total = round(p["price"] * qty, 2)
        t = base + timedelta(days=i % 5, hours=random.randint(8, 20), minutes=random.randint(0, 59))
        ts = t.isoformat()

        statuses = ["completed", "completed", "completed", "pending_ship", "shipped"]
        status = random.choice(statuses) if p.get("category") == "physical" else "completed"

        order = {
            "id": str(uuid.uuid4()),
            "user_id": u["id"],
            "username": u["username"],
            "product_id": p["id"],
            "product_name": p["name"],
            "quantity": qty,
            "total_price": total,
            "category": p.get("category", "virtual"),
            "shipping_address": f"福建省福州市马尾区XX路{i+1}号" if p.get("category") == "physical" and random.random() > 0.5 else "",
            "shipping_phone": f"138{random.randint(10000000, 99999999)}" if p.get("category") == "physical" else "",
            "status": status,
            "created_at": ts,
        }
        orders.append(order)

        txn = {
            "id": str(uuid.uuid4()),
            "type": "purchase",
            "from_address": u["wallet_address"],
            "from_name": u["nickname"],
            "to_address": "0xGM_SHOP_SYSTEM",
            "to_name": "MetaBank商城",
            "amount": total,
            "note": f"购买 {p['name']} x{qty}",
            "created_at": ts,
        }
        transactions.append(txn)

    # 3. 生成用户间转账
    for i in range(25):
        u1, u2 = random.sample(normal_users, 2)
        amt = round(random.uniform(50, 500), 2)
        t = base + timedelta(days=i % 3, hours=random.randint(10, 18))
        ts = t.isoformat()

        txn = {
            "id": str(uuid.uuid4()),
            "type": "transfer",
            "from_address": u1["wallet_address"],
            "from_name": u1["nickname"],
            "to_address": u2["wallet_address"],
            "to_name": u2["nickname"],
            "amount": amt,
            "note": random.choice(["转账", "红包", "还款", "赠送"]),
            "created_at": ts,
        }
        transactions.append(txn)

    # 按时间排序
    market.sort(key=lambda x: x.get("created_at", ""))
    transactions.sort(key=lambda x: x.get("created_at", ""))
    orders.sort(key=lambda x: x.get("created_at", ""), reverse=True)

    _write("market.json", market)
    _write("transactions.json", transactions)
    _write("orders.json", orders)

    # 更新商品 sales（仅针对本次新增的订单）
    new_orders = orders[-50:] if len(orders) > 50 else orders
    for o in new_orders:
        for p in products:
            if p["id"] == o["product_id"]:
                p["sales"] = p.get("sales", 0) + o.get("quantity", 1)
                break
    _write("products.json", products)

    print(f"已生成: 交易所交易 {len(market)} 条, 商城订单 {len(orders)} 条, 交易记录 {len(transactions)} 条")

if __name__ == "__main__":
    main()
