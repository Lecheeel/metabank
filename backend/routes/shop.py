from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from storage import read_json, write_json, append_json, find_one, update_json
from auth_utils import get_current_user, require_admin
from datetime import datetime
from typing import Optional
import uuid

router = APIRouter()

class ProductCreate(BaseModel):
    name: str
    description: str
    price: float
    image: str = ""
    category: str = "virtual"
    stock: int = 999

class OrderCreate(BaseModel):
    product_id: str
    quantity: int = 1
    shipping_address: str = ""
    shipping_phone: str = ""

def _init_products():
    products = read_json("products.json")
    if not products:
        defaults = [
            {"id": str(uuid.uuid4()), "name": "国脉AI智能助手VIP月卡", "description": "解锁全部AI功能，包含市场预测、自动交易等高级功能", "price": 500, "image": "🤖", "category": "virtual", "stock": 999, "sales": 0},
            {"id": str(uuid.uuid4()), "name": "元宇宙虚拟土地 - 金融街", "description": "位于MetaBank金融街核心区域的虚拟土地一块", "price": 5000, "image": "🏙️", "category": "virtual", "stock": 100, "sales": 0},
            {"id": str(uuid.uuid4()), "name": "数字藏品 - 国脉20周年纪念NFT", "description": "限量发行的国脉科技成立20周年数字纪念藏品", "price": 2000, "image": "🎨", "category": "virtual", "stock": 50, "sales": 0},
            {"id": str(uuid.uuid4()), "name": "国脉智能手环", "description": "支持健康监测、NFC支付，与MetaBank钱包深度集成", "price": 1500, "image": "⌚", "category": "physical", "stock": 200, "sales": 0},
            {"id": str(uuid.uuid4()), "name": "养老社区体检套餐", "description": "包含全面健康检查、AI健康报告及个性化养老建议", "price": 800, "image": "🏥", "category": "physical", "stock": 500, "sales": 0},
            {"id": str(uuid.uuid4()), "name": "MetaBank定制保温杯", "description": "304不锈钢材质，刻有专属钱包地址二维码", "price": 200, "image": "🥤", "category": "physical", "stock": 1000, "sales": 0},
            {"id": str(uuid.uuid4()), "name": "国脉云服务器1个月", "description": "2核4G云服务器一个月使用权，支持国脉币支付", "price": 300, "image": "☁️", "category": "virtual", "stock": 999, "sales": 0},
            {"id": str(uuid.uuid4()), "name": "VR养老社区通行证", "description": "进入MetaBank VR养老社区的永久通行证", "price": 3000, "image": "🥽", "category": "virtual", "stock": 500, "sales": 0},
        ]
        write_json("products.json", defaults)
        return defaults
    return products

_init_products()

@router.get("/products")
def list_products(category: Optional[str] = None):
    products = read_json("products.json")
    if category:
        products = [p for p in products if p.get("category") == category]
    return products

@router.get("/products/{product_id}")
def get_product(product_id: str):
    p = find_one("products.json", "id", product_id)
    if not p:
        raise HTTPException(404, "商品不存在")
    return p

@router.post("/products")
def create_product(req: ProductCreate, user=Depends(require_admin)):
    product = {
        "id": str(uuid.uuid4()),
        "name": req.name,
        "description": req.description,
        "price": req.price,
        "image": req.image,
        "category": req.category,
        "stock": req.stock,
        "sales": 0,
        "created_at": datetime.now().isoformat()
    }
    append_json("products.json", product)
    return product

@router.post("/order")
def create_order(req: OrderCreate, user=Depends(get_current_user)):
    product = find_one("products.json", "id", req.product_id)
    if not product:
        raise HTTPException(404, "商品不存在")
    if product["stock"] < req.quantity:
        raise HTTPException(400, "库存不足")

    total = product["price"] * req.quantity
    buyer = find_one("users.json", "username", user["sub"])
    if buyer["balance"] < total:
        raise HTTPException(400, "国脉币余额不足")

    if product["category"] == "physical" and (not req.shipping_address or not req.shipping_phone):
        raise HTTPException(400, "实物商品请填写收货地址和手机号")

    update_json("users.json", "id", buyer["id"], {"balance": buyer["balance"] - total})
    update_json("products.json", "id", product["id"], {
        "stock": product["stock"] - req.quantity,
        "sales": product.get("sales", 0) + req.quantity
    })

    order = {
        "id": str(uuid.uuid4()),
        "user_id": buyer["id"],
        "username": buyer["username"],
        "product_id": product["id"],
        "product_name": product["name"],
        "quantity": req.quantity,
        "total_price": total,
        "category": product["category"],
        "shipping_address": req.shipping_address,
        "shipping_phone": req.shipping_phone,
        "status": "completed" if product["category"] == "virtual" else "pending_ship",
        "created_at": datetime.now().isoformat()
    }
    append_json("orders.json", order)

    txn = {
        "id": str(uuid.uuid4()),
        "type": "purchase",
        "from_address": buyer["wallet_address"],
        "from_name": buyer["nickname"],
        "to_address": "0xGM_SHOP_SYSTEM",
        "to_name": "MetaBank商城",
        "amount": total,
        "note": f"购买 {product['name']} x{req.quantity}",
        "created_at": datetime.now().isoformat()
    }
    append_json("transactions.json", txn)

    return {"message": "购买成功", "order": order, "new_balance": buyer["balance"] - total}

@router.get("/orders")
def my_orders(user=Depends(get_current_user)):
    orders = read_json("orders.json")
    my = [o for o in orders if o.get("username") == user["sub"]]
    my.sort(key=lambda x: x.get("created_at", ""), reverse=True)
    return my
