from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from storage import read_json, append_json, find_one, update_json, write_json
from auth_utils import get_current_user
from datetime import datetime, timedelta
from typing import Optional
import uuid, random

router = APIRouter()

# 社区动态假数据：长者朋友圈风格
FAKE_NICKNAMES = [
    "老张头", "王阿姨", "李大爷", "陈奶奶", "刘叔", "赵婶", "孙伯伯", "周阿姨",
    "吴爷爷", "郑奶奶", "钱叔", "老林", "黄阿姨", "何大爷", "老罗", "高奶奶",
    "退休老王", "幸福老李", "健康张姐", "快乐陈叔", "阳光刘姨", "悠然赵伯",
]

def _init_community_feed():
    """初始化社区动态假数据"""
    try:
        posts = read_json("community_posts.json")
        if posts:
            return posts
    except Exception:
        pass

    now = datetime.now()
    posts = []

    # 生活分享
    life_posts = [
        ("今天去公园散步，遇到几个老伙计下棋，心情真好！", "🌳"),
        ("孙子考上大学了，全家高兴！在社区分享一下喜悦～", "🎓"),
        ("和老伴去菜市场买了新鲜蔬菜，健康饮食从今天开始", "🥬"),
        ("社区组织的书法班开课了，练了一上午字，心静下来了", "✍️"),
        ("周末和邻居们一起包饺子，其乐融融", "🥟"),
        ("阳台的花开了，拍一张给大家看看", "🌸"),
        ("今天天气好，带孙子去动物园玩了一整天", "🦁"),
        ("学会了用手机拍照，给老伴拍了几张，她说拍得不错哈哈", "📷"),
    ]

    # 运动获得国脉币
    sport_posts = [
        ("晨跑3公里完成！获得 15 国脉币奖励，坚持运动身体好～", 15, "🏃"),
        ("今天走了8000步，健康打卡成功，+12 GMC 到账！", 12, "🚶"),
        ("广场舞跳了一小时，运动奖励 8 国脉币，越动越年轻", 8, "💃"),
        ("太极拳晨练完成，养生又赚币，+10 GMC", 10, "🧘"),
        ("游泳500米，健康币+20，夏天就该多运动", 20, "🏊"),
        ("骑行10公里，绿色出行奖励 18 国脉币", 18, "🚴"),
        ("打了一小时门球，老有所乐还赚了 6 GMC", 6, "🏑"),
        ("健步走5公里，社区奖励 14 国脉币到账", 14, "👟"),
    ]

    # 商城购物分享
    shop_posts = [
        ("在商城买了国脉智能手环，测心率很方便，推荐给大家！", "国脉智能手环", 1500, "⌚"),
        ("给老伴买了养老社区体检套餐，健康最重要", "养老社区体检套餐", 800, "🏥"),
        ("入手了国脉AI智能助手VIP月卡，AI分析行情太方便了", "国脉AI智能助手VIP月卡", 500, "🤖"),
        ("买了MetaBank定制保温杯，质量不错，刻了钱包地址", "MetaBank定制保温杯", 200, "🥤"),
        ("抢到数字藏品国脉20周年纪念NFT，限量版值得收藏", "数字藏品-国脉20周年纪念NFT", 2000, "🎨"),
        ("买了VR养老社区通行证，可以进VR社区体验了", "VR养老社区通行证", 3000, "🥽"),
        ("国脉云服务器1个月，学学新东西", "国脉云服务器1个月", 300, "☁️"),
        ("元宇宙虚拟土地金融街一块，投资养老两不误", "元宇宙虚拟土地-金融街", 5000, "🏙️"),
    ]

    # 交易理财分享
    trade_posts = [
        ("今天买入 50 份国脉AI概念股，看好AI养老前景", "GMAI", 50, "buy"),
        ("定投国脉科技 100 份，长期持有", "GM", 100, "buy"),
        ("元宇宙指数加仓 20 份，分批建仓策略", "METAV", 20, "buy"),
        ("卖出部分GMC获利了结，落袋为安", "GMC", 200, "sell"),
        ("AI金融ETF 定投第3期，坚持定投", "AIFIN", 30, "buy"),
        ("国脉币期货小试一把，赚了点零花钱", "GMFT", 50, "buy"),
        ("加仓国脉科技，公司基本面不错", "GM", 80, "buy"),
        ("国脉AI概念涨了不少，减仓一半锁定利润", "GMAI", 25, "sell"),
    ]

    for i in range(24):
        t = now - timedelta(hours=random.randint(1, 72), minutes=random.randint(0, 59))
        nick = random.choice(FAKE_NICKNAMES)
        post_type = random.choice(["life", "sport", "shop", "trade"])
        post_id = str(uuid.uuid4())

        if post_type == "life":
            content, emoji = random.choice(life_posts)
            extra = {}
        elif post_type == "sport":
            content, gmc, emoji = random.choice(sport_posts)
            extra = {"gmc_earned": gmc, "emoji": emoji}
        elif post_type == "shop":
            content, prod, price, emoji = random.choice(shop_posts)
            extra = {"product": prod, "price": price, "emoji": emoji}
        else:
            content, sym, amt, action = random.choice(trade_posts)
            extra = {"symbol": sym, "amount": amt, "action": action}

        likes_count = random.randint(0, 28)
        comment_count = random.randint(0, 8)
        comments = []
        for _ in range(comment_count):
            cn = random.choice(FAKE_NICKNAMES)
            if cn != nick:
                comments.append({
                    "id": str(uuid.uuid4()),
                    "nickname": cn,
                    "content": random.choice(["点赞！", "真不错！", "向您学习", "厉害", "羡慕", "加油", "说得对", "👍"]),
                    "created_at": (t + timedelta(minutes=random.randint(1, 120))).isoformat()
                })

        posts.append({
            "id": post_id,
            "username": f"user_{nick[:2]}{i}",
            "nickname": nick,
            "type": post_type,
            "content": content,
            "extra": extra,
            "created_at": t.isoformat(),
            "likes": likes_count,
            "liked_by": [],
            "comments": comments,
        })

    posts.sort(key=lambda x: x["created_at"], reverse=True)
    write_json("community_posts.json", posts)
    return posts


@router.get("/feed")
def get_community_feed(user=Depends(get_current_user)):
    """获取社区动态（朋友圈风格）"""
    try:
        posts = read_json("community_posts.json")
        if not posts:
            posts = _init_community_feed()
    except Exception:
        posts = _init_community_feed()
    return {"posts": posts}


@router.post("/feed/{post_id}/like")
def like_post(post_id: str, user=Depends(get_current_user)):
    """点赞动态"""
    posts = read_json("community_posts.json")
    me = find_one("users.json", "username", user["sub"])
    if not me:
        raise HTTPException(404, "用户不存在")
    my_username = me["username"]
    for p in posts:
        if p["id"] == post_id:
            liked = p.get("liked_by") or []
            if my_username in liked:
                liked = [x for x in liked if x != my_username]
                p["likes"] = max(0, p["likes"] - 1)
                now_liked = False
            else:
                liked = liked + [my_username]
                p["likes"] = p.get("likes", 0) + 1
                now_liked = True
            p["liked_by"] = liked
            write_json("community_posts.json", posts)
            return {"liked": now_liked, "likes": p["likes"]}
    raise HTTPException(404, "动态不存在")


class CommentReq(BaseModel):
    content: str


@router.post("/feed/{post_id}/comment")
def comment_post(post_id: str, req: CommentReq, user=Depends(get_current_user)):
    """评论动态"""
    posts = read_json("community_posts.json")
    me = find_one("users.json", "username", user["sub"])
    if not me:
        raise HTTPException(404, "用户不存在")
    for p in posts:
        if p["id"] == post_id:
            comment = {
                "id": str(uuid.uuid4()),
                "nickname": me["nickname"],
                "username": me["username"],
                "content": req.content[:200],
                "created_at": datetime.now().isoformat()
            }
            p["comments"] = p.get("comments", []) + [comment]
            write_json("community_posts.json", posts)
            return {"comment": comment}
    raise HTTPException(404, "动态不存在")


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
