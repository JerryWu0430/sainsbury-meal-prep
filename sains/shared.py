"""Cross-instance state: shared cache, one-scrape-at-a-time slot, per-URL lock, breaker.
Backends: Redis (REDIS_URL) or Postgres/Supabase (POSTGRES_URL) — same semantics via atomic statements.
Every call degrades to a no-op when no backend is configured or it errors — the scraper must never fail because state did."""
import json
import os
import random
import time
import zlib

from .config import MIN_GAP_S

MAX_BYTES = 200_000  # compressed cache entries above this are skipped
_backend = None


# ---------- Redis ----------
class _Redis:
    def __init__(self, url):
        import redis
        self.r = redis.Redis.from_url(url, socket_timeout=2, socket_connect_timeout=2)

    def ping(self): return bool(self.r.ping())
    def get(self, k): return self.r.get(f"sains:{k}")
    def set(self, k, v, ttl): self.r.set(f"sains:{k}", v, ex=ttl)
    def delete(self, k): self.r.delete(f"sains:{k}")
    def ttl(self, k): return max(0, self.r.ttl(f"sains:{k}"))
    def set_nx(self, k, ttl_ms): return bool(self.r.set(f"sains:{k}", "1", nx=True, px=ttl_ms))


# ---------- Postgres (Supabase) ----------
class _Postgres:
    DDL = "CREATE TABLE IF NOT EXISTS sains_kv (key text PRIMARY KEY, value bytea, expires_at timestamptz NOT NULL)"

    def __init__(self, url):
        import psycopg
        self.psycopg = psycopg
        self.url = url
        with self._conn() as c:
            c.execute(self.DDL)

    def _conn(self):
        return self.psycopg.connect(self.url, connect_timeout=3, autocommit=True)

    def _one(self, sql, *args):
        with self._conn() as c:
            return c.execute(sql, args).fetchone()

    def ping(self): return self._one("SELECT 1") is not None
    def get(self, k):
        row = self._one("SELECT value FROM sains_kv WHERE key=%s AND expires_at > now()", k)
        return bytes(row[0]) if row else None
    def set(self, k, v, ttl):
        self._one("INSERT INTO sains_kv VALUES (%s,%s,now()+%s*interval '1 second') ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value, expires_at=EXCLUDED.expires_at RETURNING key", k, v, ttl)
    def delete(self, k): self._one("DELETE FROM sains_kv WHERE key=%s RETURNING key", k)
    def ttl(self, k):
        row = self._one("SELECT GREATEST(0, EXTRACT(EPOCH FROM expires_at-now()))::int FROM sains_kv WHERE key=%s", k)
        return row[0] if row else 0
    def set_nx(self, k, ttl_ms):  # atomic: only wins if the key is absent or expired
        row = self._one("INSERT INTO sains_kv VALUES (%s,NULL,now()+%s*interval '1 millisecond') ON CONFLICT (key) DO UPDATE SET expires_at=EXCLUDED.expires_at WHERE sains_kv.expires_at <= now() RETURNING key", k, ttl_ms)
        return row is not None


def _be():
    global _backend
    if _backend is None:
        if os.environ.get("REDIS_URL"):
            _backend = _Redis(os.environ["REDIS_URL"])
        elif os.environ.get("POSTGRES_URL"):
            _backend = _Postgres(os.environ["POSTGRES_URL"])
        else:
            _backend = False
    return _backend or None


def _safe(fn, default=None):
    try:
        b = _be()
        return fn(b) if b else default
    except Exception:
        return default


def backend_name() -> str | None:
    b = _safe(lambda b: b)
    return type(b).__name__.strip("_").lower() if b else None


def ping() -> bool:
    return bool(_safe(lambda b: b.ping()))


def cache_get(key: str):
    raw = _safe(lambda b: b.get(f"c:{key}"))
    return json.loads(zlib.decompress(raw)) if raw else None


def cache_set(key: str, data, ttl: int) -> None:
    blob = zlib.compress(json.dumps(data).encode(), 6)
    if len(blob) <= MAX_BYTES:
        _safe(lambda b: b.set(f"c:{key}", blob, ttl))


def blocked_for() -> int:
    """Seconds left on the shared breaker, 0 if clear."""
    return _safe(lambda b: b.ttl("blocked"), 0) or 0


def set_blocked(seconds: int) -> None:
    _safe(lambda b: b.set("blocked", b"1", seconds))


def acquire_slot(max_wait: float = 25) -> None:
    """Global rate limit: at most one scrape starts per MIN_GAP_S across all instances."""
    deadline = time.time() + max_wait
    while time.time() < deadline:
        if _safe(lambda b: b.set_nx("slot", int(MIN_GAP_S * 1000)), True):
            return
        time.sleep(0.15 + random.random() * 0.2)


def lock(key: str, ttl: int = 40) -> bool:
    """True if we own the fetch for this key; False if another instance is already fetching it."""
    return bool(_safe(lambda b: b.set_nx(f"l:{key}", ttl * 1000), True))


def unlock(key: str) -> None:
    _safe(lambda b: b.delete(f"l:{key}"))


def wait_for(key: str, max_wait: float = 30):
    """Another instance is fetching this key — wait for its result to land in the shared cache."""
    deadline = time.time() + max_wait
    while time.time() < deadline:
        time.sleep(0.3)
        if (data := cache_get(key)) is not None:
            return data
        if not _safe(lambda b: b.ttl(f"l:{key}"), 0):
            break  # fetcher gave up
    return None
