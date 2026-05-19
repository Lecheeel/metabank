"""
MetaBank 市场价格模型
====================
基于几何布朗运动 (GBM) + Merton 跳跃扩散模型，引入四个宏观因子驱动漂移项，
为六个交易标的提供差异化的价格路径模拟。

核心 SDE:
    dS_t = μ_eff(t) · S_t · dt + σ · S_t · dW_t + (J_t - 1) · S_t · dN_t

其中 μ_eff 由宏观因子线性组合:
    μ_eff = μ_base + β_cpi·CPI + β_ai·AIHeat_norm + β_gold·GoldPremium + β_sent·Sentiment

N_t ~ Poisson(λ·Δt), ln(J_t) ~ N(μ_J, σ_J²)。
"""
from __future__ import annotations

import math
import random
import threading
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Dict, List, Optional


# ============================================================
# 1. 资产画像 (AssetProfile)
# ============================================================

@dataclass(frozen=True)
class AssetProfile:
    symbol: str
    base_price: float
    mu_base: float        # 年化基础漂移率
    sigma: float          # 年化波动率
    jump_lambda: float    # 年跳跃强度 (次/年)
    jump_mu: float        # 跳跃幅度对数正态均值
    jump_sigma: float     # 跳跃幅度对数正态标准差
    beta_cpi: float       # 通胀敏感度
    beta_ai: float        # AI 热度敏感度
    beta_gold: float      # 黄金溢价敏感度
    beta_sentiment: float # 市场情绪敏感度


_ASSET_PROFILES: Dict[str, AssetProfile] = {
    "GM": AssetProfile(
        symbol="GM", base_price=12.5,
        mu_base=0.08, sigma=0.25, jump_lambda=6.0, jump_mu=-0.01, jump_sigma=0.04,
        beta_cpi=0.3, beta_ai=0.5, beta_gold=0.0, beta_sentiment=0.4,
    ),
    "GMAI": AssetProfile(
        symbol="GMAI", base_price=25.0,
        mu_base=0.15, sigma=0.40, jump_lambda=12.0, jump_mu=0.0, jump_sigma=0.07,
        beta_cpi=0.2, beta_ai=1.2, beta_gold=0.0, beta_sentiment=0.6,
    ),
    "GMC": AssetProfile(
        symbol="GMC", base_price=1.0,
        mu_base=0.02, sigma=0.05, jump_lambda=1.0, jump_mu=0.0, jump_sigma=0.01,
        beta_cpi=-0.1, beta_ai=0.0, beta_gold=0.0, beta_sentiment=0.1,
    ),
    "GMFT": AssetProfile(
        symbol="GMFT", base_price=1.05,
        mu_base=0.10, sigma=0.45, jump_lambda=18.0, jump_mu=0.0, jump_sigma=0.06,
        beta_cpi=0.0, beta_ai=0.4, beta_gold=0.0, beta_sentiment=0.8,
    ),
    "METAV": AssetProfile(
        symbol="METAV", base_price=100.0,
        mu_base=0.12, sigma=0.30, jump_lambda=8.0, jump_mu=0.0, jump_sigma=0.05,
        beta_cpi=0.2, beta_ai=0.8, beta_gold=0.0, beta_sentiment=0.5,
    ),
    "AIFIN": AssetProfile(
        symbol="AIFIN", base_price=50.0,
        mu_base=0.10, sigma=0.22, jump_lambda=5.0, jump_mu=0.0, jump_sigma=0.035,
        beta_cpi=0.1, beta_ai=0.7, beta_gold=0.0, beta_sentiment=0.4,
    ),
}


def get_asset_profile(symbol: str) -> Optional[AssetProfile]:
    return _ASSET_PROFILES.get(symbol)


def list_asset_profiles() -> List[AssetProfile]:
    return list(_ASSET_PROFILES.values())


# ============================================================
# 2. 宏观因子 (60 秒缓存)
# ============================================================

_macro_cache: Dict[str, object] = {"value": None, "expire_at": datetime.min}
_macro_lock = threading.Lock()
_MACRO_TTL_SECONDS = 60

# 前一拍因子值，用于 AR(1) / OU 演化
_macro_prev: Dict[str, float] = {
    "cpi": 2.3,
    "ai_heat": 60.0,
    "gold_premium": 1.0,
    "sentiment": 0.0,
}


def _step_macro_factors() -> Dict[str, float]:
    """按时间步演化一拍宏观因子。内部使用，外部请调用 get_macro_factors()。"""
    # CPI: 随机游走，日波动 0.05%，钳制在 [0.5, 5]
    cpi_new = _macro_prev["cpi"] + random.gauss(0, 0.05)
    cpi_new = max(0.5, min(5.0, cpi_new))

    # AI 热度: OU 过程 dX = θ(μ-X)dt + σdW, 均值回复 60, θ=0.15, σ=8
    theta, mu_ai, sigma_ai = 0.15, 60.0, 8.0
    ai_new = _macro_prev["ai_heat"] + theta * (mu_ai - _macro_prev["ai_heat"]) + random.gauss(0, sigma_ai)
    ai_new = max(0.0, min(100.0, ai_new))

    # 黄金溢价: 与 CPI 正相关的噪声
    gold_new = 0.5 * (cpi_new - 2.0) + random.gauss(0, 0.4)
    gold_new = max(-2.0, min(3.0, gold_new))

    # 市场情绪: AR(1), φ=0.7, σ=0.25
    sent_new = 0.7 * _macro_prev["sentiment"] + random.gauss(0, 0.25)
    sent_new = max(-1.0, min(1.0, sent_new))

    _macro_prev["cpi"] = cpi_new
    _macro_prev["ai_heat"] = ai_new
    _macro_prev["gold_premium"] = gold_new
    _macro_prev["sentiment"] = sent_new

    return {
        "cpi": round(cpi_new, 3),
        "ai_heat": round(ai_new, 2),
        "gold_premium": round(gold_new, 3),
        "sentiment": round(sent_new, 3),
    }


def get_macro_factors() -> Dict[str, object]:
    """返回当前宏观因子快照（60s 缓存）。"""
    now = datetime.now()
    with _macro_lock:
        if _macro_cache["value"] is not None and now < _macro_cache["expire_at"]:
            return _macro_cache["value"]
        factors = _step_macro_factors()
        snapshot = {
            **factors,
            "updated_at": now.isoformat(),
            "description": {
                "cpi": "通胀指数 (%)",
                "ai_heat": "AI 热度指数 (0-100)",
                "gold_premium": "黄金溢价 (%)",
                "sentiment": "市场情绪 (-1 ~ +1)",
            },
        }
        _macro_cache["value"] = snapshot
        _macro_cache["expire_at"] = now + timedelta(seconds=_MACRO_TTL_SECONDS)
        return snapshot


# ============================================================
# 3. 价格路径模拟 (GBM + Merton 跳跃扩散)
# ============================================================

_TRADING_DAYS_PER_YEAR = 252


def _effective_drift(profile: AssetProfile, macro: Dict[str, float]) -> float:
    """合成年化漂移率 μ_eff = μ_base + Σ β_i · factor_i。
    宏观因子量纲统一归一化：CPI、gold 以百分点带入；AI 热度归一到 [-1,+1]；情绪本身即 [-1,+1]。"""
    ai_norm = (macro["ai_heat"] - 60.0) / 40.0  # 以 60 为中性，±40 为 ±1
    cpi_excess = (macro["cpi"] - 2.0) / 100.0    # 超出 2% 部分，转成小数
    gold_pct = macro["gold_premium"] / 100.0
    sent = macro["sentiment"]
    return (
        profile.mu_base
        + profile.beta_cpi * cpi_excess
        + profile.beta_ai * ai_norm * 0.1          # AI 热度影响上限 ±12% 漂移 (β_ai=1.2)
        + profile.beta_gold * gold_pct
        + profile.beta_sentiment * sent * 0.05     # 情绪影响上限 ±4%
    )


def _simulate_daily(profile: AssetProfile, days: int, rng: random.Random, macro: Dict[str, float]) -> List[float]:
    """用日级递推模拟 close 价格序列，长度 = days。"""
    mu_eff = _effective_drift(profile, macro)
    sigma = profile.sigma
    dt = 1.0 / _TRADING_DAYS_PER_YEAR
    lam_dt = profile.jump_lambda * dt

    price = profile.base_price
    closes: List[float] = []
    for _ in range(days):
        # GBM 连续部分
        z = rng.gauss(0, 1)
        drift = (mu_eff - 0.5 * sigma * sigma) * dt
        diffusion = sigma * math.sqrt(dt) * z
        # 跳跃次数 ~ Poisson(λ·dt)，对小 λ·dt 用伯努利近似（一日最多一次跳跃，误差可忽略）
        jump_log = 0.0
        if rng.random() < lam_dt:
            jump_log = rng.gauss(profile.jump_mu, profile.jump_sigma)
        price = price * math.exp(drift + diffusion + jump_log)
        # 防数值爆炸
        price = max(price, profile.base_price * 0.2)
        price = min(price, profile.base_price * 5.0)
        closes.append(price)
    return closes


def simulate_price_path(symbol: str, days: int = 90, seed: Optional[int] = None) -> List[Dict]:
    """生成 OHLCV K 线序列。相同 symbol 与 seed 下可重现。"""
    profile = get_asset_profile(symbol)
    if profile is None:
        return []

    if seed is None:
        seed = hash((symbol, datetime.now().strftime("%Y%m%d"))) & 0xFFFFFFFF
    rng = random.Random(seed)

    macro = {
        "cpi": _macro_prev["cpi"],
        "ai_heat": _macro_prev["ai_heat"],
        "gold_premium": _macro_prev["gold_premium"],
        "sentiment": _macro_prev["sentiment"],
    }

    closes = _simulate_daily(profile, days, rng, macro)

    data: List[Dict] = []
    now = datetime.now()
    prev_close = profile.base_price
    for i, close in enumerate(closes):
        dt = now - timedelta(days=days - i)
        open_p = prev_close
        # 日内 high/low 用对数正态噪声扩展
        hi_spread = abs(rng.gauss(0, profile.sigma * 0.3 / math.sqrt(_TRADING_DAYS_PER_YEAR))) + 0.003
        lo_spread = abs(rng.gauss(0, profile.sigma * 0.3 / math.sqrt(_TRADING_DAYS_PER_YEAR))) + 0.003
        high = max(open_p, close) * (1 + hi_spread)
        low = min(open_p, close) * (1 - lo_spread)
        # 成交量与波动率关联：波动大 → 成交量放大
        vol_mult = 1.0 + 5.0 * abs(close - open_p) / max(open_p, 1e-6)
        volume = int(rng.randint(50_000, 300_000) * vol_mult)
        data.append({
            "date": dt.strftime("%Y-%m-%d"),
            "open": round(open_p, 4),
            "close": round(close, 4),
            "high": round(high, 4),
            "low": round(low, 4),
            "volume": volume,
        })
        prev_close = close
    return data


# ============================================================
# 4. 当前价格 (最新一日 close + 当分钟微扰)
# ============================================================

_price_cache: Dict[str, Dict] = {}
_price_lock = threading.Lock()
_PRICE_TTL_SECONDS = 60


def get_current_price(symbol: str) -> Optional[float]:
    """取 90 日路径的末日 close，再叠加分钟级微扰，结果按分钟缓存。"""
    profile = get_asset_profile(symbol)
    if profile is None:
        return None

    now = datetime.now()
    with _price_lock:
        cached = _price_cache.get(symbol)
        if cached and now < cached["expire_at"]:
            return cached["price"]

        path = simulate_price_path(symbol, days=90)
        last_close = path[-1]["close"] if path else profile.base_price

        # 分钟级微扰：以 symbol+minute 为种子，保证同一分钟稳定
        minute_seed = hash((symbol, now.strftime("%Y%m%d%H%M"))) & 0xFFFFFFFF
        rng = random.Random(minute_seed)
        minute_sigma = profile.sigma / math.sqrt(_TRADING_DAYS_PER_YEAR * 24 * 60)
        price = last_close * math.exp(rng.gauss(0, minute_sigma * 60))  # 1 小时尺度微扰
        price = round(price, 4)

        _price_cache[symbol] = {"price": price, "expire_at": now + timedelta(seconds=_PRICE_TTL_SECONDS)}
        return price
