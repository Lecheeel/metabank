from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from storage import read_json, append_json, find_one, update_json
from auth_utils import get_current_user
from datetime import datetime
from typing import Optional
import uuid

router = APIRouter()

class SendMessageReq(BaseModel):
    to_username: str
    content: str
    transfer_amount: Optional[float] = None

@router.post("/send")
def send_message(req: SendMessageReq, user=Depends(get_current_user)):
    sender = find_one("users.json", "username", user["sub"])
    receiver = find_one("users.json", "username", req.to_username)
    if not receiver:
        raise HTTPException(404, "接收方用户不存在")
    if sender["username"] == receiver["username"]:
        raise HTTPException(400, "不能给自己发消息")

    transfer_txn = None
    if req.transfer_amount and req.transfer_amount > 0:
        if sender["balance"] < req.transfer_amount:
            raise HTTPException(400, "国脉币余额不足")
        update_json("users.json", "id", sender["id"], {"balance": round(sender["balance"] - req.transfer_amount, 4)})
        update_json("users.json", "id", receiver["id"], {"balance": round(receiver["balance"] + req.transfer_amount, 4)})
        transfer_txn = {
            "id": str(uuid.uuid4()),
            "type": "chat_transfer",
            "from_address": sender["wallet_address"],
            "from_name": sender["nickname"],
            "to_address": receiver["wallet_address"],
            "to_name": receiver["nickname"],
            "amount": req.transfer_amount,
            "note": f"私聊转账: {req.content[:50]}",
            "created_at": datetime.now().isoformat()
        }
        append_json("transactions.json", transfer_txn)

    message = {
        "id": str(uuid.uuid4()),
        "from_username": sender["username"],
        "from_nickname": sender["nickname"],
        "from_wallet": sender["wallet_address"],
        "to_username": receiver["username"],
        "to_nickname": receiver["nickname"],
        "to_wallet": receiver["wallet_address"],
        "content": req.content,
        "transfer_amount": req.transfer_amount,
        "transfer_txn_id": transfer_txn["id"] if transfer_txn else None,
        "read": False,
        "created_at": datetime.now().isoformat()
    }
    append_json("messages.json", message)
    return {"message": "发送成功", "data": message}

@router.get("/conversations")
def get_conversations(user=Depends(get_current_user)):
    messages = read_json("messages.json")
    my_msgs = [m for m in messages if m["from_username"] == user["sub"] or m["to_username"] == user["sub"]]

    convos = {}
    for m in my_msgs:
        other = m["to_username"] if m["from_username"] == user["sub"] else m["from_username"]
        if other not in convos or m["created_at"] > convos[other]["last_time"]:
            other_user = find_one("users.json", "username", other)
            unread = len([msg for msg in my_msgs if msg["from_username"] == other and not msg.get("read")])
            convos[other] = {
                "username": other,
                "nickname": other_user["nickname"] if other_user else other,
                "wallet_address": other_user["wallet_address"] if other_user else "",
                "avatar": other_user.get("avatar", "") if other_user else "",
                "last_message": m["content"][:50],
                "last_time": m["created_at"],
                "unread": unread
            }

    result = list(convos.values())
    result.sort(key=lambda x: x["last_time"], reverse=True)
    return result

@router.get("/messages/{username}")
def get_messages(username: str, user=Depends(get_current_user)):
    messages = read_json("messages.json")
    chat_msgs = [m for m in messages
                 if (m["from_username"] == user["sub"] and m["to_username"] == username) or
                    (m["from_username"] == username and m["to_username"] == user["sub"])]
    chat_msgs.sort(key=lambda x: x["created_at"])

    all_msgs = read_json("messages.json")
    for m in all_msgs:
        if m["from_username"] == username and m["to_username"] == user["sub"]:
            m["read"] = True
    from storage import write_json
    write_json("messages.json", all_msgs)

    return chat_msgs
