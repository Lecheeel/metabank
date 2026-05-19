"""
监护工具：大额交易拦截与审批流。
"""
from datetime import datetime, timedelta
from typing import Callable, Any
import uuid
from storage import read_json, write_json, append_json, find_one, update_json

PENDING_FILE = "pending_approvals.json"
APPROVAL_TTL_HOURS = 24


def _ensure_file():
    import os, json
    path = os.path.join(os.path.dirname(__file__), "data", PENDING_FILE)
    if not os.path.exists(path):
        json.dump([], open(path, "w"))


def check_needs_approval(user: dict, amount: float) -> bool:
    """判断该笔交易是否需要监护人审批。"""
    guardians = user.get("guardians", [])
    daily_limit = user.get("daily_limit", 5000.0)
    return bool(guardians) and amount >= daily_limit


def create_pending_approval(user: dict, action_type: str, action_meta: dict, amount: float) -> dict:
    """创建待审批记录，返回 approval 对象。"""
    _ensure_file()
    approval = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "username": user["username"],
        "nickname": user.get("nickname", user["username"]),
        "action_type": action_type,   # 'trade' | 'transfer' | 'order'
        "action_meta": action_meta,   # 原始请求参数
        "amount": amount,
        "status": "pending",          # pending | approved | rejected | expired
        "guardian_ids": [g["user_id"] for g in user.get("guardians", [])],
        "created_at": datetime.now().isoformat(),
        "expires_at": (datetime.now() + timedelta(hours=APPROVAL_TTL_HOURS)).isoformat(),
    }
    append_json(PENDING_FILE, approval)
    return approval


def get_pending_for_guardian(guardian_user_id: str) -> list:
    """返回该监护人需要审批的所有待审批记录（未过期）。"""
    _ensure_file()
    records = read_json(PENDING_FILE)
    now = datetime.now().isoformat()
    return [
        r for r in records
        if r.get("status") == "pending"
        and guardian_user_id in r.get("guardian_ids", [])
        and r.get("expires_at", "") > now
    ]


def get_pending_for_user(user_id: str) -> list:
    """返回该用户自己发起的待审批记录。"""
    _ensure_file()
    records = read_json(PENDING_FILE)
    return [r for r in records if r.get("user_id") == user_id]


def process_approval(approval_id: str, decision: str, executor: Callable[[], Any]):
    """
    处理审批决定。
    decision: 'approve' | 'reject'
    executor: 若 approve，调用此函数执行原交易，返回其结果。
    """
    _ensure_file()
    records = read_json(PENDING_FILE)
    rec = next((r for r in records if r["id"] == approval_id), None)
    if not rec:
        return None, "审批记录不存在"
    if rec["status"] != "pending":
        return None, f"该记录已处理（{rec['status']}）"
    if rec.get("expires_at", "") < datetime.now().isoformat():
        rec["status"] = "expired"
        write_json(PENDING_FILE, records)
        return None, "审批已超时"

    rec["status"] = "approved" if decision == "approve" else "rejected"
    rec["decided_at"] = datetime.now().isoformat()
    write_json(PENDING_FILE, records)

    if decision == "approve":
        try:
            result = executor()
            return result, None
        except Exception as e:
            return None, f"执行交易失败: {e}"
    return {"message": "已拒绝"}, None
