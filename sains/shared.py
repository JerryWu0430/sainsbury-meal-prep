"""Cross-instance state in Redis (Vercel Marketplace): shared cache, one-scrape-at-a-time slot, per-URL lock, breaker.
Every call degrades to a no-op when REDIS_URL is unset or Redis errors — the scraper must never fail because Redis did."""
import json
import os
import random
import time
import zlib

from .config import MIN_GAP_S

_r = None
MAX_BYTES = 200_000  # compressed; free tier is 30 MB


def _redis():
    global _r
    if _r is None and os.environ.get("REDIS_URL"):
        import redis
        _r = redis.Redis.from_url(os.environ["REDIS_URL"], socket_timeout=2, socket_connect_timeout=2)
    return _r


def _safe(fn, default=None):
    try:
        r = _redis()
        return fn(r) if r else default
    except Exception:
        return default


def cache_get(key: str):
    raw = _safe(lambda r: r.get(f"sains:c:{key}"))
    return json.loads(zlib.decompress(raw)) if raw else None


def cache_set(key: str, data, ttl: int) -> None:
    blob = zlib.compress(json.dumps(data).encode(), 6)
    if len(blob) <= MAX_BYTES:
        _safe(lambda r: r.set(f"sains:c:{key}", blob, ex=ttl))


def blocked_for() -> int:
    """Seconds left on the shared breaker, 0 if clear."""
    return _safe(lambda r: r.ttl("sains:blocked"), 0) or 0


def set_blocked(seconds: int) -> None:
    _safe(lambda r: r.set("sains:blocked", "1", ex=seconds))


def acquire_slot(max_wait: float = 25) -> None:
    """Global rate limit: at most one scrape starts per MIN_GAP_S across all instances (SET NX PX as a token)."""
    deadline = time.time() + max_wait
    while time.time() < deadline:
        if _safe(lambda r: r.set("sains:slot", "1", nx=True, px=int(MIN_GAP_S * 1000)), True):
            return
        time.sleep(0.15 + random.random() * 0.2)


def lock(key: str, ttl: int = 40) -> bool:
    """True if we own the fetch for this key; False if another instance is already fetching it."""
    return bool(_safe(lambda r: r.set(f"sains:l:{key}", "1", nx=True, ex=ttl), True))


def unlock(key: str) -> None:
    _safe(lambda r: r.delete(f"sains:l:{key}"))


def wait_for(key: str, max_wait: float = 30):
    """Another instance is fetching this key — wait for its result to land in the shared cache."""
    deadline = time.time() + max_wait
    while time.time() < deadline:
        time.sleep(0.3)
        if (data := cache_get(key)) is not None:
            return data
        if not _safe(lambda r: r.exists(f"sains:l:{key}"), 0):
            break  # fetcher gave up
    return None
