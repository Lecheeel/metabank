from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routes import auth, wallet, shop, exchange, chat, llm, admin
import os, json

app = FastAPI(title="MetaBank API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DATA_DIR = os.path.join(os.path.dirname(__file__), "data")
os.makedirs(DATA_DIR, exist_ok=True)

for fname in ["users.json", "products.json", "orders.json", "transactions.json", "messages.json", "market.json", "auto_tasks.json"]:
    fpath = os.path.join(DATA_DIR, fname)
    if not os.path.exists(fpath):
        json.dump([], open(fpath, "w"))

app.include_router(auth.router, prefix="/api/auth", tags=["Auth"])
app.include_router(wallet.router, prefix="/api/wallet", tags=["Wallet"])
app.include_router(shop.router, prefix="/api/shop", tags=["Shop"])
app.include_router(exchange.router, prefix="/api/exchange", tags=["Exchange"])
app.include_router(chat.router, prefix="/api/chat", tags=["Chat"])
app.include_router(llm.router, prefix="/api/llm", tags=["LLM"])
app.include_router(admin.router, prefix="/api/admin", tags=["Admin"])

@app.get("/api/health")
def health():
    return {"status": "ok", "name": "MetaBank API"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
