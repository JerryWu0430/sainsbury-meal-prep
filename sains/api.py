"""Thin, throttled, cached HTTP layer. curl_cffi impersonates Chrome TLS (plain curl/requests get 403)."""
import hashlib, json, random, time
from pathlib import Path

from curl_cffi import requests

from .config import CACHE_TTL_S, MIN_GAP_S

PRODUCT = "https://www.sainsburys.co.uk/groceries-api/gol-services/product/v1/product"
STORES = "https://stores.sainsburys.co.uk/api/v1/stores"
CACHE = Path.home() / ".cache" / "sains"

_session = None
_last = 0.0


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


def get(url: str, params: dict | None = None, ttl: int = CACHE_TTL_S) -> dict:
    key = hashlib.sha1(json.dumps([url, params], sort_keys=True).encode()).hexdigest()
    f = CACHE / f"{key}.json"
    if f.exists() and time.time() - f.stat().st_mtime < ttl:
        return json.loads(f.read_text())

    status = None
    for attempt in range(3):
        _throttle()
        r = _sess().get(url, params=params, headers={"Accept": "application/json"}, timeout=20)
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
    raise RuntimeError(f"HTTP {status} after retries — Akamai is blocking; stop and retry later")


def clear_cache() -> int:
    n = 0
    for f in CACHE.glob("*.json"):
        f.unlink(); n += 1
    return n
