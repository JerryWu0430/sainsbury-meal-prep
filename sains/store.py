"""Store info from the public store-locator API (hours, facilities). NB: no public per-store stock API exists."""
from .api import STORES, get
from .config import STORE_CODE

DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]


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
