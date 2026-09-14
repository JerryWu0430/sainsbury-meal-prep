"""Thin, throttled, cached HTTP layer. curl_cffi impersonates Chrome TLS (plain curl/requests get 403)."""
import hashlib, json, os, random, time
from pathlib import Path

from curl_cffi import requests

from . import shared
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
    if (data := shared.cache_get(key)) is not None:  # another instance already fetched it
        _store(f, data)
        return data

    left = max(int(_blocked_until - time.time()), shared.blocked_for())
    if left > 0:
        raise Blocked(f"scraping paused for {left}s after a block — serving cache only")
    if not shared.lock(key):  # same URL in flight elsewhere: wait for its result instead of scraping twice
        if (data := shared.wait_for(key)) is not None:
            _store(f, data)
            return data
    try:
        status = None
        for attempt in range(3):
            shared.acquire_slot()  # global: one scrape per MIN_GAP_S across every instance
            _throttle()            # local: same gap within this process
            r = _sess().get(url, params=params, headers={"Accept": "application/json", **(headers or {})}, timeout=20)
            status = r.status_code
            if status == 200:
                data = r.json()
                _store(f, data)
                shared.cache_set(key, data, ttl)
                return data
            if status in (403, 429):  # bot-blocked / rate-limited: exponential backoff
                time.sleep(5 * 2**attempt)
                continue
            r.raise_for_status()
        _blocked_until = time.time() + COOLDOWN_S
        shared.set_blocked(COOLDOWN_S)
        raise Blocked(f"HTTP {status} after retries — Akamai is blocking; pausing scrapes for {COOLDOWN_S // 60} min")
    finally:
        shared.unlock(key)


def _store(f: Path, data) -> None:
    CACHE.mkdir(parents=True, exist_ok=True)
    f.write_text(json.dumps(data))


def clear_cache() -> int:
    n = 0
    for f in CACHE.glob("*.json"):
        f.unlink(); n += 1
    return n
