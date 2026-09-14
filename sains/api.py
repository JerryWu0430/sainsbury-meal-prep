"""Thin, throttled, cached HTTP layer. curl_cffi impersonates Chrome TLS (plain curl/requests get 403)."""
import hashlib, json, os, random, time
from pathlib import Path

from curl_cffi import requests

from .config import CACHE_TTL_S, MIN_GAP_S

PRODUCT = "https://www.sainsburys.co.uk/groceries-api/gol-services/product/v1/product"
STORES = "https://stores.sainsburys.co.uk/api/v1/stores"
# serverless (Vercel) has only /tmp writable; cache is best-effort there
CACHE = Path("/tmp/sains") if os.environ.get("VERCEL") else Path.home() / ".cache" / "sains"

_session = None
_last = 0.0
_blocked_until = 0.0
COOLDOWN_S = 30 * 60  # after a 403/429 streak, stop hitting Sainsbury's from this instance for a while


class Blocked(RuntimeError):
    pass


def _sess():
    global _session
    if _session is None:
        _session = requests.Session(impersonate="chrome")
    return _session


def _throttle():
    global _last
    wait = MIN_GAP_S + random.uniform(0, 0.7) - (time.time() - _last)
    if wait > 0:
        time.sleep(wait)
    _last = time.time()


def get(url: str, params: dict | None = None, ttl: int = CACHE_TTL_S, headers: dict | None = None) -> dict:
    global _blocked_until
    key = hashlib.sha1(json.dumps([url, params], sort_keys=True).encode()).hexdigest()
    f = CACHE / f"{key}.json"
    if f.exists() and time.time() - f.stat().st_mtime < ttl:
        return json.loads(f.read_text())

    if time.time() < _blocked_until:
        raise Blocked(f"scraping paused for {int(_blocked_until - time.time())}s after a block — serving cache only")
    status = None
    for attempt in range(3):
        _throttle()
        r = _sess().get(url, params=params, headers={"Accept": "application/json", **(headers or {})}, timeout=20)
        status = r.status_code
        if status == 200:
            data = r.json()
            CACHE.mkdir(parents=True, exist_ok=True)
            f.write_text(json.dumps(data))
            return data
        if status in (403, 429):  # bot-blocked / rate-limited: exponential backoff
            time.sleep(5 * 2**attempt)
            continue
        r.raise_for_status()
    _blocked_until = time.time() + COOLDOWN_S
    raise Blocked(f"HTTP {status} after retries — Akamai is blocking; pausing scrapes for {COOLDOWN_S // 60} min")


def clear_cache() -> int:
    n = 0
    for f in CACHE.glob("*.json"):
        f.unlink(); n += 1
    return n
