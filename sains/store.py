"""Store info + location search via the public store-locator API. NB: no public per-store stock API exists."""
import re
from math import asin, cos, radians, sin, sqrt

from .api import STORES, get
from .config import STORE_CODE

DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
_LIST = {"fields": "slfe-list-2.21", "api_client_id": "slfe"}
_UA = {"User-Agent": "sainsbury-meal-prep/0.1 (personal; github.com/JerryWu0430/sainsbury-meal-prep)"}


def info(code: str = STORE_CODE) -> dict:
    return get(f"{STORES}/{code}", {"fields": "slfe-details-2.21", "api_client_id": "slfe"}, ttl=24 * 3600)["store"]


def summary(s: dict) -> dict:
    c = s["contact"]
    return {
        "name": s["name"],
        "code": s["code"],
        "type": s.get("store_type"),
        "cluster": s.get("additional_data", {}).get("store_cluster_name"),
        "address": f"{c['address1']}, {c['city']} {c['post_code']}",
        "tel": c.get("telephone"),
        "open_now": s.get("open"),
        "status": s.get("current_status"),
        "hours": [(DAYS[t["day"]], f"{t['start_time']}–{t['end_time']}") for t in s.get("opening_times", [])],
        "facilities": sorted({f["name"] for f in s.get("facilities", []) if f.get("is_visible", True)}),
        "fsa": s.get("fsa_scores"),
    }


def geocode(q: str) -> tuple[float, float, str]:
    """UK postcode / outcode via postcodes.io, anything else via Nominatim (1 req/s policy — cached 24h)."""
    pc = re.sub(r"\s+", "", q).upper()
    if re.fullmatch(r"[A-Z]{1,2}\d[A-Z\d]?\d[A-Z]{2}", pc):
        r = get(f"https://api.postcodes.io/postcodes/{pc}", ttl=30 * 86400)["result"]
        return r["latitude"], r["longitude"], f"{r['postcode']}, {r['admin_district']}"
    if re.fullmatch(r"[A-Z]{1,2}\d[A-Z\d]?", pc):
        r = get(f"https://api.postcodes.io/outcodes/{pc}", ttl=30 * 86400)["result"]
        return r["latitude"], r["longitude"], f"{r['outcode']} area"
    hits = get("https://nominatim.openstreetmap.org/search", {"q": q, "format": "json", "limit": 1, "countrycodes": "gb"}, ttl=30 * 86400, headers=_UA)
    if not hits:
        raise LookupError(f"couldn't locate '{q}'")
    return float(hits[0]["lat"]), float(hits[0]["lon"]), hits[0]["display_name"].split(",")[0]


def _km(lat1, lon1, lat2, lon2) -> float:
    lat1, lon1, lat2, lon2 = map(radians, (lat1, lon1, lat2, lon2))
    a = sin((lat2 - lat1) / 2) ** 2 + cos(lat1) * cos(lat2) * sin((lon2 - lon1) / 2) ** 2
    return 6371 * 2 * asin(sqrt(a))


def nearby(lat: float, lon: float, limit: int = 8) -> list[dict]:
    res = get(STORES, {**_LIST, "lat": lat, "lon": lon, "limit": limit, "store_type": "main,local", "sort": "by_distance"}, ttl=86400)
    out = []
    for s in res.get("results", []):
        c, o = s["contact"], s.get("open") or {}
        out.append({
            "code": s["code"], "name": s["name"], "type": s.get("store_type"),
            "address": f"{c['address1']}, {c['post_code']}",
            "km": round(_km(lat, lon, float(s["location"]["lat"]), float(s["location"]["lon"])), 2),
            "open_now": o.get("is_open"), "open_until": o.get("open_until"),
        })
    return out


def find(q: str, limit: int = 8) -> dict:
    lat, lon, label = geocode(q)
    return {"query": q, "label": label, "stores": nearby(lat, lon, limit)}
