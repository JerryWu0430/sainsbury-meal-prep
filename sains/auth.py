"""Verifies the dashboard's login cookie (signed by lib/auth.ts): "<exp>.<base64url hmac-sha256(AUTH_SECRET, exp)>"."""
import base64
import hashlib
import hmac
import os
import time

COOKIE = "sains_auth"


def enabled() -> bool:
    """Same rule as lib/auth.ts: open locally without APP_PASSWORD, always on on Vercel (fails closed)."""
    return bool(os.environ.get("APP_PASSWORD") or os.environ.get("VERCEL"))


def _sig(exp: str, secret: str) -> str:
    return base64.urlsafe_b64encode(hmac.new(secret.encode(), exp.encode(), hashlib.sha256).digest()).rstrip(b"=").decode()


def verify(token: str | None, now: float | None = None) -> bool:
    secret = os.environ.get("AUTH_SECRET")
    if not token or not secret or "." not in token:
        return False
    exp, sig = token.split(".", 1)
    return exp.isdigit() and int(exp) > (now or time.time()) and hmac.compare_digest(sig, _sig(exp, secret))
