from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from storage import read_json, find_one, update_json, append_json
from auth_utils import get_current_user
from datetime import datetime
import uuid
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
import guardian_utils

router = APIRouter()

class TransferReq(BaseModel):
    to_address: str
    amount: float
    note: str = ""

@router.get("/info")
def wallet_info(user=Depends(get_current_user)):
    u = find_one("users.json", "username", user["sub"])
    if not u:
        raise HTTPException(404, "用户不存在")
    txns = read_json("transactions.json")
    my_txns = [t for t in txns if t.get("from_address") == u["wallet_address"] or t.get("to_address") == u["wallet_address"]]
    my_txns.sort(key=lambda x: x.get("created_at", ""), reverse=True)
    return {
        "wallet_address": u["wallet_address"],
        "balance": u["balance"],
        "transactions": my_txns[:50]
    }

@router.post("/transfer")
def transfer(req: TransferReq, user=Depends(get_current_user)):
    if req.amount <= 0:
        raise HTTPException(400, "转账金额必须大于0")
    sender = find_one("users.json", "username", user["sub"])
    if not sender:
        raise HTTPException(404, "发送方不存在")
    if sender["balance"] < req.amount:
        raise HTTPException(400, "余额不足")
    receiver = find_one("users.json", "wallet_address", req.to_address)
    if not receiver:
        raise HTTPException(404, "接收方钱包地址不存在")
    if sender["wallet_address"] == req.to_address:
        raise HTTPException(400, "不能给自己转账")

    # 监护拦截
    if guardian_utils.check_needs_approval(sender, req.amount):
        approval = guardian_utils.create_pending_approval(
            sender, "transfer",
            {"to_address": req.to_address, "amount": req.amount, "note": req.note or ""},
            req.amount,
        )
        return {
            "status": "pending_approval",
            "approval_id": approval["id"],
            "message": f"转账金额 {req.amount} GMC 超过大额阈值，已通知监护人审批",
        }

    return _do_transfer(sender, req.to_address, req.amount, req.note or "")


def _do_transfer(sender: dict, to_address: str, amount: float, note: str) -> dict:
    receiver = find_one("users.json", "wallet_address", to_address)
    if not receiver:
        raise HTTPException(404, "接收方钱包地址不存在")
    update_json("users.json", "id", sender["id"], {"balance": sender["balance"] - amount})
    update_json("users.json", "id", receiver["id"], {"balance": receiver["balance"] + amount})

    txn = {
        "id": str(uuid.uuid4()),
        "type": "transfer",
        "from_address": sender["wallet_address"],
        "from_name": sender["nickname"],
        "to_address": receiver["wallet_address"],
        "to_name": receiver["nickname"],
        "amount": amount,
        "note": note,
        "created_at": datetime.now().isoformat()
    }
    append_json("transactions.json", txn)
    return {"message": "转账成功", "transaction": txn, "new_balance": sender["balance"] - amount}

@router.get("/transactions")
def get_transactions(user=Depends(get_current_user)):
    u = find_one("users.json", "username", user["sub"])
    txns = read_json("transactions.json")
    my_txns = [t for t in txns if t.get("from_address") == u["wallet_address"] or t.get("to_address") == u["wallet_address"]]
    my_txns.sort(key=lambda x: x.get("created_at", ""), reverse=True)
    return my_txns

@router.get("/lookup/{address}")
def lookup_address(address: str):
    u = find_one("users.json", "wallet_address", address)
    if not u:
        raise HTTPException(404, "地址不存在")
    return {"wallet_address": u["wallet_address"], "nickname": u["nickname"], "username": u["username"]}
