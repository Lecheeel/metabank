from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from storage import read_json, write_json, find_one, update_json, append_json
from auth_utils import get_current_user
from datetime import datetime
import uuid
import guardian_utils

router = APIRouter()


class BindReq(BaseModel):
    target_username: str   # 对方用户名（子女或老人）
    relation: str          # 如 "子女" / "父母" / "配偶"


class LimitReq(BaseModel):
    daily_limit: float


class ApproveReq(BaseModel):
    decision: str  # 'approve' | 'reject'


# ── 发送绑定邀请 ──────────────────────────────────────────────────
@router.post("/bind")
def send_bind_request(req: BindReq, user=Depends(get_current_user)):
    me = find_one("users.json", "username", user["sub"])
    target = find_one("users.json", "username", req.target_username)
    if not target:
        raise HTTPException(404, "用户不存在")
    if target["id"] == me["id"]:
        raise HTTPException(400, "不能绑定自己")

    requests = read_json("guardian_requests.json")
    # 检查是否已有待处理邀请
    existing = [r for r in requests if r["from_id"] == me["id"] and r["to_id"] == target["id"] and r["status"] == "pending"]
    if existing:
        raise HTTPException(400, "已有待处理的绑定邀请")

    record = {
        "id": str(uuid.uuid4()),
        "from_id": me["id"],
        "from_username": me["username"],
        "from_nickname": me.get("nickname", me["username"]),
        "to_id": target["id"],
        "to_username": target["username"],
        "to_nickname": target.get("nickname", target["username"]),
        "relation": req.relation,
        "status": "pending",
        "created_at": datetime.now().isoformat(),
    }
    append_json("guardian_requests.json", record)
    return {"message": "绑定邀请已发送", "request": record}


# ── 查看收到的邀请 ────────────────────────────────────────────────
@router.get("/requests")
def get_requests(user=Depends(get_current_user)):
    me = find_one("users.json", "username", user["sub"])
    requests = read_json("guardian_requests.json")
    pending = [r for r in requests if r["to_id"] == me["id"] and r["status"] == "pending"]
    return pending


# ── 处理邀请 ──────────────────────────────────────────────────────
@router.post("/requests/{req_id}/accept")
def accept_request(req_id: str, user=Depends(get_current_user)):
    me = find_one("users.json", "username", user["sub"])
    requests = read_json("guardian_requests.json")
    rec = next((r for r in requests if r["id"] == req_id), None)
    if not rec:
        raise HTTPException(404, "邀请不存在")
    if rec["to_id"] != me["id"]:
        raise HTTPException(403, "无权操作")
    if rec["status"] != "pending":
        raise HTTPException(400, "邀请已处理")

    rec["status"] = "accepted"
    rec["decided_at"] = datetime.now().isoformat()
    write_json("guardian_requests.json", requests)

    # 双向写入 guardians / wards
    sender = find_one("users.json", "id", rec["from_id"])
    # sender 是发起方（老人），me 是接受方（子女）
    sender_guardians = sender.get("guardians", [])
    if not any(g["user_id"] == me["id"] for g in sender_guardians):
        sender_guardians.append({"user_id": me["id"], "nickname": me.get("nickname", me["username"]), "relation": rec["relation"], "bound_at": datetime.now().isoformat()})
        update_json("users.json", "id", sender["id"], {"guardians": sender_guardians})

    me_wards = me.get("wards", [])
    if sender["id"] not in me_wards:
        me_wards.append(sender["id"])
        update_json("users.json", "id", me["id"], {"wards": me_wards})

    return {"message": "绑定成功"}


@router.post("/requests/{req_id}/reject")
def reject_request(req_id: str, user=Depends(get_current_user)):
    me = find_one("users.json", "username", user["sub"])
    requests = read_json("guardian_requests.json")
    rec = next((r for r in requests if r["id"] == req_id), None)
    if not rec:
        raise HTTPException(404, "邀请不存在")
    if rec["to_id"] != me["id"]:
        raise HTTPException(403, "无权操作")
    rec["status"] = "rejected"
    rec["decided_at"] = datetime.now().isoformat()
    write_json("guardian_requests.json", requests)
    return {"message": "已拒绝"}


# ── 查看我的监护人 ────────────────────────────────────────────────
@router.get("/guardians")
def my_guardians(user=Depends(get_current_user)):
    me = find_one("users.json", "username", user["sub"])
    return {"guardians": me.get("guardians", []), "daily_limit": me.get("daily_limit", 5000.0)}


# ── 查看我监护的老人 ──────────────────────────────────────────────
@router.get("/wards")
def my_wards(user=Depends(get_current_user)):
    me = find_one("users.json", "username", user["sub"])
    ward_ids = me.get("wards", [])
    users = read_json("users.json")
    wards = [
        {"id": u["id"], "username": u["username"], "nickname": u.get("nickname", u["username"]),
         "balance": u.get("balance", 0), "daily_limit": u.get("daily_limit", 5000.0)}
        for u in users if u["id"] in ward_ids
    ]
    return wards


# ── 调整大额阈值 ──────────────────────────────────────────────────
@router.put("/daily-limit")
def set_daily_limit(req: LimitReq, user=Depends(get_current_user)):
    if req.daily_limit < 0:
        raise HTTPException(400, "阈值不能为负数")
    me = find_one("users.json", "username", user["sub"])
    update_json("users.json", "id", me["id"], {"daily_limit": req.daily_limit})
    return {"message": "阈值已更新", "daily_limit": req.daily_limit}


# ── 查看待审批交易 ────────────────────────────────────────────────
@router.get("/pending-approvals")
def pending_approvals(user=Depends(get_current_user)):
    me = find_one("users.json", "username", user["sub"])
    return guardian_utils.get_pending_for_guardian(me["id"])


# ── 我自己发起的待审批 ────────────────────────────────────────────
@router.get("/my-pending")
def my_pending(user=Depends(get_current_user)):
    me = find_one("users.json", "username", user["sub"])
    return guardian_utils.get_pending_for_user(me["id"])


# ── 审批 ──────────────────────────────────────────────────────────
@router.post("/approve/{approval_id}")
def approve(approval_id: str, req: ApproveReq, user=Depends(get_current_user)):
    me = find_one("users.json", "username", user["sub"])
    records = guardian_utils.read_json(guardian_utils.PENDING_FILE) if hasattr(guardian_utils, 'read_json') else read_json(guardian_utils.PENDING_FILE)
    rec = next((r for r in records if r["id"] == approval_id), None)
    if not rec:
        raise HTTPException(404, "审批记录不存在")
    if me["id"] not in rec.get("guardian_ids", []):
        raise HTTPException(403, "无权审批")

    action_type = rec.get("action_type")
    meta = rec.get("action_meta", {})

    def executor():
        ward = find_one("users.json", "id", rec["user_id"])
        if action_type == "transfer":
            from routes.wallet import _do_transfer
            return _do_transfer(ward, meta["to_address"], meta["amount"], meta.get("note", ""))
        elif action_type == "trade":
            from routes.exchange import _do_trade
            return _do_trade(ward, meta["symbol"], meta["action"], meta["amount"], meta["price"])
        elif action_type == "order":
            from routes.shop import _do_order
            return _do_order(ward, meta)
        return {"message": "已执行"}

    result, err = guardian_utils.process_approval(approval_id, req.decision, executor)
    if err:
        raise HTTPException(400, err)
    return result or {"message": "已处理"}
