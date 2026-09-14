"""FastAPI wrapper over the sains scraper — deployed as a Vercel Python function, also `uv run uvicorn api.index:app`."""
import os
import sys
from pathlib import Path
from urllib.parse import quote

import httpx

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))  # make `sains` importable on Vercel

from fastapi import FastAPI, HTTPException, Query, Request, Response
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from sains import agent, mealprep, products, store
from sains.cli import NEW_KWS, STAPLES
from sains.config import MODEL, STORE_CODE

app = FastAPI(title="sains api")
CACHE_HDR = {"Cache-Control": "public, s-maxage=21600, stale-while-revalidate=86400"}  # 6h fresh at the CDN, then serve stale instantly while refreshing


def _kws(kw: str | None, default: list[str]) -> list[str]:
    return [k.strip() for k in kw.split(",") if k.strip()] if kw else default


def _multi(kws: list[str], **opts) -> list[dict]:
    seen, out = set(), []
    for k in kws:
        for i in products.search(k, **opts):
            if i["uid"] not in seen and i["price"] and i["available"]:
                seen.add(i["uid"]); out.append(i)
    return out


@app.get("/api/store")
def get_store(res: Response, store_code: str | None = Query(None, alias="store")):
    res.headers.update(CACHE_HDR)
    return store.summary(store.info(store_code or STORE_CODE))


@app.get("/api/stores")
def get_stores(res: Response, q: str, limit: int = Query(8, le=20)):
    """Nearest stores to a UK postcode / outcode / place name."""
    res.headers.update(CACHE_HDR)
    try:
        return store.find(q, limit)
    except LookupError as e:
        raise HTTPException(404, str(e))


class Ask(BaseModel):
    question: str
    store: str | None = None


@app.post("/api/ask")
async def post_ask(body: Ask):
    """Streams the agent's markdown answer as plain text chunks."""
    try:
        agent.check_model()
    except agent.ConfigError as e:
        raise HTTPException(503, str(e))
    gen = agent.stream(body.question, body.store or STORE_CODE)
    return StreamingResponse(gen, media_type="text/plain; charset=utf-8", headers={"Cache-Control": "no-store", "X-Accel-Buffering": "no", "X-Model": MODEL})


@app.get("/api/offers")
def get_offers(res: Response, kw: str | None = None, min: int = Query(0, alias="min")):
    res.headers.update(CACHE_HDR)
    items = [i for i in _multi(_kws(kw, STAPLES), offers=True, max_pages=1) if i["pct"] >= min]
    items.sort(key=lambda i: (-i["pct"], i["price"] or 0))
    return items


@app.get("/api/new")
def get_new(res: Response, kw: str | None = None):
    res.headers.update(CACHE_HDR)
    return _multi(_kws(kw, NEW_KWS), new=True, max_pages=1)


@app.get("/api/search")
def get_search(res: Response, q: str, offers: bool = False, new: bool = False, sort: str = "relevance", pages: int = Query(1, le=3)):
    res.headers.update(CACHE_HDR)
    return products.search(q, offers=offers, new=new, sort=sort, max_pages=pages)


@app.get("/api/mealprep")
def get_mealprep(res: Response, full: bool = False):
    res.headers.update(CACHE_HDR)
    return mealprep.plan(full=full)


@app.get("/api/warm")
def get_warm(request: Request):
    """Vercel cron target: re-fetch the dashboard's default URLs through the public host so the CDN is warm."""
    secret = os.environ.get("CRON_SECRET")
    if secret and request.headers.get("authorization") != f"Bearer {secret}":
        raise HTTPException(401)
    host = request.headers.get("x-forwarded-host") or request.headers.get("host")
    base = f"https://{host}" if host and "localhost" not in host else str(request.base_url).rstrip("/")
    urls = [f"{base}/api/search?q={quote(k)}&offers={o}&new={n}" for k, o, n in
            [(k, "true", "false") for k in STAPLES] + [(k, "false", "true") for k in NEW_KWS]] + [f"{base}/api/mealprep?full=false", f"{base}/api/store"]
    out = {}
    for u in urls:
        try:
            out[u.split("/api/", 1)[1]] = httpx.get(u, timeout=120).status_code
        except Exception as e:  # keep warming the rest
            out[u.split("/api/", 1)[1]] = str(e)[:60]
    return out


@app.get("/api/item/{uid}")
def get_item(uid: str, res: Response):
    res.headers.update(CACHE_HDR)
    return products.detail(uid)
