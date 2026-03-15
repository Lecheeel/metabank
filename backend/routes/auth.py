from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from storage import read_json, append_json, find_one, update_json
from auth_utils import (hash_password, verify_password, generate_wallet_address,
                        create_access_token, get_current_user)
from datetime import datetime
import uuid

router = APIRouter()

class RegisterReq(BaseModel):
    username: str
    password: str
    nickname: str = ""
    phone: str = ""

class LoginReq(BaseModel):
    username: str
    password: str

class UpdateProfileReq(BaseModel):
    nickname: str = None
    phone: str = None
    avatar: str = None
    address: str = None

@router.post("/register")
def register(req: RegisterReq):
    if find_one("users.json", "username", req.username):
        raise HTTPException(400, "用户名已存在")
    user = {
        "id": str(uuid.uuid4()),
        "username": req.username,
        "password": hash_password(req.password),
        "nickname": req.nickname or req.username,
        "phone": req.phone,
        "avatar": "",
        "address": "",
        "wallet_address": generate_wallet_address(),
        "balance": 10000.0,
        "is_admin": False,
        "created_at": datetime.now().isoformat()
    }
    append_json("users.json", user)
    token = create_access_token({"sub": user["username"], "uid": user["id"], "is_admin": False})
    return {"token": token, "user": {k: v for k, v in user.items() if k != "password"}}

@router.post("/login")
def login(req: LoginReq):
    user = find_one("users.json", "username", req.username)
    if not user or not verify_password(req.password, user["password"]):
        raise HTTPException(401, "用户名或密码错误")
    token = create_access_token({"sub": user["username"], "uid": user["id"], "is_admin": user.get("is_admin", False)})
    return {"token": token, "user": {k: v for k, v in user.items() if k != "password"}}

@router.get("/me")
def me(user=Depends(get_current_user)):
    u = find_one("users.json", "username", user["sub"])
    if not u:
        raise HTTPException(404, "用户不存在")
    return {k: v for k, v in u.items() if k != "password"}

@router.put("/profile")
def update_profile(req: UpdateProfileReq, user=Depends(get_current_user)):
    updates = {k: v for k, v in req.dict().items() if v is not None}
    update_json("users.json", "username", user["sub"], updates)
    u = find_one("users.json", "username", user["sub"])
    return {k: v for k, v in u.items() if k != "password"}

@router.get("/users")
def list_users(user=Depends(get_current_user)):
    users = read_json("users.json")
    return [{"id": u["id"], "username": u["username"], "nickname": u["nickname"],
             "wallet_address": u["wallet_address"], "avatar": u.get("avatar", "")} for u in users]
