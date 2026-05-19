from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from routes import auth, wallet, shop, exchange, chat, llm, admin, voice, guardian, tts
import os, json

app = FastAPI(title="MetaBank API", version="1.0.0",
              description="MetaBank - 元宇宙金融养老社区 API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DATA_DIR = os.path.join(os.path.dirname(__file__), "data")
os.makedirs(DATA_DIR, exist_ok=True)

for fname in ["users.json", "products.json", "orders.json", "transactions.json", "messages.json", "market.json", "auto_tasks.json", "community_posts.json", "guardian_requests.json", "pending_approvals.json"]:
    fpath = os.path.join(DATA_DIR, fname)
    if not os.path.exists(fpath):
        json.dump([], open(fpath, "w"))

settings_path = os.path.join(DATA_DIR, "settings.json")
if not os.path.exists(settings_path):
    json.dump({
        "dashscope_api_key": "",
        "llm_model": "qwen3.6-flash",
        "llm_system_prompt": "",
        "tts_speed_profile": "standard",
    }, open(settings_path, "w"), ensure_ascii=False, indent=2)

# 懒补用户字段（监护相关）
_users_path = os.path.join(DATA_DIR, "users.json")
if os.path.exists(_users_path):
    _users = json.load(open(_users_path, "r", encoding="utf-8"))
    _changed = False
    for _u in _users:
        if "guardians" not in _u:
            _u["guardians"] = []; _changed = True
        if "wards" not in _u:
            _u["wards"] = []; _changed = True
        if "daily_limit" not in _u:
            _u["daily_limit"] = 5000.0; _changed = True
    if _changed:
        json.dump(_users, open(_users_path, "w", encoding="utf-8"), ensure_ascii=False, indent=2)

app.include_router(auth.router, prefix="/api/auth", tags=["Auth"])
app.include_router(wallet.router, prefix="/api/wallet", tags=["Wallet"])
app.include_router(shop.router, prefix="/api/shop", tags=["Shop"])
app.include_router(exchange.router, prefix="/api/exchange", tags=["Exchange"])
app.include_router(chat.router, prefix="/api/chat", tags=["Chat"])
app.include_router(llm.router, prefix="/api/llm", tags=["LLM"])
app.include_router(admin.router, prefix="/api/admin", tags=["Admin"])
app.include_router(voice.router, prefix="/api/voice", tags=["Voice"])
app.include_router(guardian.router, prefix="/api/guardian", tags=["Guardian"])
app.include_router(tts.router, prefix="/api/tts", tags=["TTS"])

@app.get("/api/health")
def health():
    return {"status": "ok", "name": "MetaBank API", "version": "1.0.0"}

DIST_DIR = os.path.join(os.path.dirname(__file__), "..", "frontend", "dist")
if os.path.exists(DIST_DIR):
    app.mount("/assets", StaticFiles(directory=os.path.join(DIST_DIR, "assets")), name="static")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        file_path = os.path.join(DIST_DIR, full_path)
        if os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse(os.path.join(DIST_DIR, "index.html"))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
