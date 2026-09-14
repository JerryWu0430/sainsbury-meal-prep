"""Product search over the gol-services product API (keyword search is the only public entry point)."""
from .api import PRODUCT, get
from .config import MAX_PAGES, PAGE_SIZE

SORTS = {"relevance": "-relevance", "price": "price", "-price": "-price", "rating": "-customer rating"}


def search(keyword: str, *, offers=False, new=False, sort="relevance", max_pages=MAX_PAGES) -> list[dict]:
    flags = ",".join(f for f, on in (("Offers", offers), ("new", new)) if on)
    out: list[dict] = []
    for page in range(1, max_pages + 1):
        params = {"filter[keyword]": keyword, "page_number": page, "page_size": PAGE_SIZE,
                  "sort_order": SORTS.get(sort, sort)}
        if flags:
            params["filter[nav_Filter-Your-Results]"] = flags
        data = get(PRODUCT, params)
        items = [slim(p) for p in data.get("products", [])]
        out += items
        total = data.get("controls", {}).get("total_record_count", 0)
        if len(items) < PAGE_SIZE or len(out) >= total:
            break
    return out


def detail(uid: str) -> dict:
    return get(f"{PRODUCT}/{uid}")


def slim(p: dict) -> dict:
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
    }
