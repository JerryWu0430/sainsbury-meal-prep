"""FastAPI wrapper over the sains scraper — deployed as a Vercel Python function, also `uv run uvicorn api.index:app`."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))  # make `sains` importable on Vercel

from fastapi import FastAPI, Query, Response

from sains import mealprep, products, store
from sains.cli import NEW_KWS, STAPLES

app = FastAPI(title="sains api")
CACHE_HDR = {"Cache-Control": "public, s-maxage=21600, stale-while-revalidate=3600"}  # 6h at Vercel's CDN


def _kws(kw: str | None, default: list[str]) -> list[str]:
    return [k.strip() for k in kw.split(",") if k.strip()] if kw else default


def _multi(kws: list[str], **opts) -> list[dict]:
    seen, out = set(), []
    for k in kws:
        for i in products.search(k, **opts):
            if i["uid"] not in seen:
                seen.add(i["uid"]); out.append(i)
    return out


@app.get("/api/store")
def get_store(res: Response):
    res.headers.update(CACHE_HDR)
    return store.summary(store.info())


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


@app.get("/api/item/{uid}")
def get_item(uid: str, res: Response):
    res.headers.update(CACHE_HDR)
    return products.detail(uid)
