"""生成假用户并追加到 users.json"""
import json
import os
import uuid
from datetime import datetime, timedelta

# 添加父目录到 path 以便导入
import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from auth_utils import hash_password, generate_wallet_address

FAKE_NICKNAMES = [
    "老张头", "王阿姨", "李大爷", "陈奶奶", "刘叔", "赵婶", "孙伯伯", "周阿姨",
    "吴爷爷", "郑奶奶", "钱叔", "老林", "黄阿姨", "何大爷", "老罗", "高奶奶",
    "退休老王", "幸福老李", "健康张姐", "快乐陈叔", "阳光刘姨", "悠然赵伯",
    "福气林婶", "平安孙爷", "吉祥吴奶", "安康钱叔", "如意周姨", "顺心郑伯",
    "开心黄婶", "舒心何爷", "暖心罗姨", "温馨高叔", "和睦老钱", "和谐小林",
]

PWD_HASH = hash_password("123456")
DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data")
USERS_PATH = os.path.join(DATA_DIR, "users.json")

def main():
    users = []
    if os.path.exists(USERS_PATH):
        with open(USERS_PATH, "r", encoding="utf-8") as f:
            users = json.load(f)

    existing_usernames = {u["username"] for u in users}
    base = datetime(2026, 3, 1, 10, 0, 0)

    for i, nick in enumerate(FAKE_NICKNAMES):
        username = f"user_{i+1:03d}"
        if username in existing_usernames:
            continue
        users.append({
            "id": str(uuid.uuid4()),
            "username": username,
            "password": PWD_HASH,
            "nickname": nick,
            "phone": f"138{10000000 + i:08d}" if i % 3 == 0 else "",
            "avatar": "",
            "address": "",
            "wallet_address": generate_wallet_address(),
            "balance": round(5000 + (i * 123) % 50000, 2),
            "is_admin": False,
            "created_at": (base + timedelta(hours=i * 2)).isoformat(),
        })
        existing_usernames.add(username)

    with open(USERS_PATH, "w", encoding="utf-8") as f:
        json.dump(users, f, ensure_ascii=False, indent=2)

    print(f"已生成 {len(users)} 个用户，假用户密码均为 123456")

if __name__ == "__main__":
    main()
