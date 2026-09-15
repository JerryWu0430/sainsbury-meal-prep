"""Product search over the gol-services product API (keyword search is the only public entry point)."""
import os

import httpx

from .api import PRODUCT, get
from .categories import classify, form
from .config import MAX_PAGES, PAGE_SIZE

# On Vercel every internal caller (agent tools, /api/offers, meal prep) goes through the public /api/search URL,
# so the CDN dedupes identical queries across all users and instances. /api/search itself passes direct=True.
CDN_HOST = os.environ.get("VERCEL_PROJECT_PRODUCTION_URL")

SORTS = {"relevance": "-relevance", "price": "price", "-price": "-price", "rating": "-customer rating"}


def search(keyword: str, *, offers=False, new=False, sort="relevance", max_pages=MAX_PAGES, direct=False) -> list[dict]:
    if CDN_HOST and not direct and max_pages == 1:
        try:
            r = httpx.get(f"https://{CDN_HOST}/api/search", params={"q": keyword, "offers": offers, "new": new, "sort": sort}, timeout=90)
            r.raise_for_status()
            return r.json()
        except httpx.HTTPError:
            pass  # fall through to a direct scrape
    flags = ",".join(f for f, on in (("Offers", offers), ("new", new)) if on)
    out: list[dict] = []
    for page in range(1, max_pages + 1):
        params = {"filter[keyword]": keyword, "page_number": page, "page_size": PAGE_SIZE,
                  "sort_order": SORTS.get(sort, sort)}
        if flags:
            params["filter[nav_Filter-Your-Results]"] = flags
        data = get(PRODUCT, params)
        catmap = _catmap(data.get("controls", {}).get("cat_filters") or [])
        items = [slim(p, catmap) for p in data.get("products", [])]
        out += items
        total = data.get("controls", {}).get("total_record_count", 0)
        if len(items) < PAGE_SIZE or len(out) >= total:
            break
    return out


def by_uids(uids: list[str]) -> list[dict]:
    """Batch lookup (one request) — used to refresh favourites."""
    data = get(PRODUCT, {"uids": ",".join(uids[:30])}, ttl=3600)
    return [slim(p) for p in data.get("products", [])]


def detail(uid: str) -> dict:
    return get(f"{PRODUCT}/{uid}")


def _catmap(tree: list) -> dict:
    """controls.cat_filters (department → aisle → shelf, with ids + item counts) → {id: (department, aisle, dept_count)},
    plus "*" = the department with most items. Only the selected department is expanded; the others are bare depth-1
    nodes. Campaign nodes ("Eat more fish") exist too but have tiny counts."""
    roots = tree[0].get("children") or [] if len(tree) == 1 and tree[0].get("id") == "all" else tree  # sometimes wrapped
    out: dict = {}
    _walk(roots, "", "", 1, 0, out)
    out["*"] = max(out.values(), key=lambda v: v[2], default=("", "", 0))[0]
    return out


def _walk(tree: list, dept: str, aisle: str, depth: int, count: int, out: dict) -> None:
    for node in tree:
        name = node.get("name", "")
        d, a, n = dept, aisle, count
        if depth == 1: d, a, n = name, "", node.get("value") or 0
        elif depth == 2: a = name
        k = str(node.get("id"))
        if k not in out or out[k][2] < n:  # same id under a campaign node and a real department: keep the bigger one
            out[k] = (d, a or name, n)
        _walk(node.get("children") or [], d, a, depth + 1, n, out)


def slim(p: dict, catmap: dict | None = None) -> dict:
    promo = (p.get("promotions") or [None])[0]
    price = p.get("retail_price", {}).get("price")
    was = promo.get("original_price") if promo else None
    if was and price and was <= price:  # e.g. "Meal Deal" promos carry was == price
        was = None
    pct = (promo or {}).get("discount_percentage")
    if not pct and was and price:
        pct = round((1 - price / was) * 100)
    unit = p.get("unit_price") or {}
    url = p.get("full_url", "")
    assets = p.get("assets") or {}
    sizes = ((assets.get("images") or [{}])[0].get("sizes") or [])
    thumb = next((s["url"] for s in sizes if s.get("width") == 140), None) or assets.get("plp_image") or p.get("image", "")
    cats = [c for c in p.get("categories") or [] if "offer" not in c.get("name", "").lower()]
    names = [c.get("name", "") for c in cats]
    hits = [h for c in cats if isinstance(h := (catmap or {}).get(str(c.get("id"))), tuple)]
    dominant = (catmap or {}).get("*", "")
    tree_dept, tree_aisle = (max(hits, key=lambda h: h[2])[:2] if hits and max(hits, key=lambda h: h[2])[2] >= 5 else ("", ""))
    # one naming authority (the classifier) so chips don't mix "Pasta" with "Food cupboard"; tree names are hints
    dept = classify(tree_dept, *names, p.get("name", ""))
    if dept == "Other":
        dept = tree_dept or dominant or "Other"
    aisle = tree_aisle if tree_aisle and tree_aisle != tree_dept else (names[0] if names else "")
    return {
        "uid": p["product_uid"],
        "name": p["name"],
        "price": price,
        "was": was,
        "pct": pct or 0,
        "unit": f"£{unit['price']}/{unit['measure']}" if unit.get("price") else "",
        "promo": promo["strap_line"] if promo else "",
        "nectar": bool(promo and promo.get("is_nectar")),
        "ends": promo["end_date"][:10] if promo and promo.get("end_date") else "",
        "life": next((l["text"] for l in p.get("labels", []) if "life" in l.get("text", "").lower()), ""),
        "available": p.get("is_available", True),
        "url": "https" + url if url.startswith("://") else url,
        "image": assets.get("plp_image") or p.get("image", ""),  # plain S3, hotlinkable, cache 24h
        "thumb": thumb,
        "category": dept,
        "subcategory": aisle if aisle != dept else "",
        "form": form(aisle, p.get("name", "")),  # ingredient | ready | frozen
    }
