from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from storage import read_json, write_json, find_one, update_json, append_json, read_settings, update_settings
from auth_utils import require_admin, get_current_user, hash_password, generate_wallet_address
from datetime import datetime
from typing import Optional
import uuid

router = APIRouter()

def _ensure_admin():
    users = read_json("users.json")
    if not any(u.get("is_admin") for u in users):
        admin = {
            "id": str(uuid.uuid4()),
            "username": "admin",
            "password": hash_password("admin123"),
            "nickname": "系统管理员",
            "phone": "13800000000",
            "avatar": "",
            "address": "",
            "wallet_address": generate_wallet_address(),
            "balance": 1000000.0,
            "is_admin": True,
            "created_at": datetime.now().isoformat()
        }
        append_json("users.json", admin)

_ensure_admin()

@router.get("/dashboard")
def dashboard(user=Depends(require_admin)):
    users = read_json("users.json")
    orders = read_json("orders.json")
    transactions = read_json("transactions.json")
    products = read_json("products.json")
    market = read_json("market.json")

    total_balance = sum(u.get("balance", 0) for u in users)
    total_tx_amount = sum(t.get("amount", 0) for t in transactions)

    return {
        "total_users": len(users),
        "total_orders": len(orders),
        "total_transactions": len(transactions),
        "total_products": len(products),
        "total_trades": len(market),
        "total_balance": round(total_balance, 2),
        "total_tx_amount": round(total_tx_amount, 2),
        "recent_orders": sorted(orders, key=lambda x: x.get("created_at", ""), reverse=True)[:10],
        "recent_transactions": sorted(transactions, key=lambda x: x.get("created_at", ""), reverse=True)[:10],
    }

@router.get("/users")
def list_users(user=Depends(require_admin)):
    users = read_json("users.json")
    return [{k: v for k, v in u.items() if k != "password"} for u in users]

@router.put("/user/{user_id}/balance")
def update_balance(user_id: str, amount: float, user=Depends(require_admin)):
    u = find_one("users.json", "id", user_id)
    if not u:
        raise HTTPException(404, "用户不存在")
    update_json("users.json", "id", user_id, {"balance": round(u["balance"] + amount, 4)})
    txn = {
        "id": str(uuid.uuid4()),
        "type": "admin_adjust",
        "from_address": "0xGM_SYSTEM",
        "from_name": "系统管理员",
        "to_address": u["wallet_address"],
        "to_name": u["nickname"],
        "amount": amount,
        "note": f"管理员调整余额 {'+'if amount>0 else ''}{amount}",
        "created_at": datetime.now().isoformat()
    }
    append_json("transactions.json", txn)
    return {"message": "余额已调整", "new_balance": round(u["balance"] + amount, 4)}

@router.get("/orders")
def list_orders(user=Depends(require_admin)):
    orders = read_json("orders.json")
    orders.sort(key=lambda x: x.get("created_at", ""), reverse=True)
    return orders

@router.put("/order/{order_id}/status")
def update_order_status(order_id: str, status: str, user=Depends(require_admin)):
    update_json("orders.json", "id", order_id, {"status": status})
    return {"message": "订单状态已更新"}

@router.get("/products")
def list_products(user=Depends(require_admin)):
    return read_json("products.json")

@router.delete("/product/{product_id}")
def delete_product(product_id: str, user=Depends(require_admin)):
    products = read_json("products.json")
    products = [p for p in products if p["id"] != product_id]
    write_json("products.json", products)
    return {"message": "商品已删除"}

class SettingsUpdate(BaseModel):
    dashscope_api_key: Optional[str] = None
    llm_model: Optional[str] = None
    llm_system_prompt: Optional[str] = None

@router.get("/settings")
def get_settings(user=Depends(require_admin)):
    settings = read_settings()
    masked = dict(settings)
    key = masked.get("dashscope_api_key", "")
    if key and len(key) > 8:
        masked["dashscope_api_key_masked"] = key[:4] + "*" * (len(key) - 8) + key[-4:]
        masked["has_api_key"] = True
    else:
        masked["dashscope_api_key_masked"] = ""
        masked["has_api_key"] = bool(key)
    masked.pop("dashscope_api_key", None)
    return masked

@router.put("/settings")
def put_settings(req: SettingsUpdate, user=Depends(require_admin)):
    updates = {k: v for k, v in req.dict().items() if v is not None}
    settings = update_settings(updates)
    masked = dict(settings)
    key = masked.get("dashscope_api_key", "")
    if key and len(key) > 8:
        masked["dashscope_api_key_masked"] = key[:4] + "*" * (len(key) - 8) + key[-4:]
        masked["has_api_key"] = True
    else:
        masked["dashscope_api_key_masked"] = ""
        masked["has_api_key"] = bool(key)
    masked.pop("dashscope_api_key", None)
    return {"message": "设置已保存", "settings": masked}

@router.delete("/settings/api-key")
def clear_api_key(user=Depends(require_admin)):
    update_settings({"dashscope_api_key": ""})
    return {"message": "API Key 已清除"}
