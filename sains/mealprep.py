"""Rule-based meal-prep planner: pull discounted staples per food group, combine into batch-cook ideas."""
import re

from . import products

GROUPS = {  # first QUICK entries of each are deliberately diverse
    "protein": ["chicken breast", "beef mince", "salmon", "chicken thighs", "eggs", "tofu"],
    "carb": ["basmati rice", "dried pasta", "sweet potato", "noodles", "wraps"],
    "veg": ["broccoli", "frozen vegetables", "peppers", "spinach", "carrots"],
    "sauce": ["curry paste", "pesto", "soy sauce", "passata", "coconut milk"],
}
QUICK = 3  # keywords per group in quick mode (fewer live requests)
# ready-made stuff is not a meal-prep ingredient
JUNK = ("pot", "ready", "instant", "microwave", "pie", "kit", "meal", "sandwich", "wrap ", "snack", "grills", "crispy", "breaded", "battered", "soup", "salad", "slices", "10kg", "5kg")
MAX_PRICE = {"protein": 8.0, "carb": 5.0, "veg": 4.0, "sauce": 4.0}  # skip bulk packs that skew per-portion cost

IDEAS = [  # (sauce substring, template)
    ("curry", "{p} curry over {c}, with {v}"),
    ("korma", "{p} korma over {c}, with {v}"),
    ("tikka", "{p} tikka over {c}, with {v}"),
    ("coconut", "Coconut {p} with {c} & {v}"),
    ("pesto", "Pesto {p} bake with {c} & {v}"),
    ("soy", "Soy-ginger {p} stir-fry on {c} with {v}"),
    ("passata", "{p} ragu/chilli on {c} with {v}"),
]
PORTIONS = 4


def _ok(i: dict, group: str) -> bool:
    n = i["name"].lower()
    return bool(i["available"] and i["price"] and i["price"] <= MAX_PRICE[group] and not any(j in n for j in JUNK))


def _pick(kw: str, group: str, on_progress) -> list[dict]:
    on_progress(kw)
    items = [i for i in products.search(kw, offers=True, max_pages=1) if _ok(i, group)]
    if not items:  # no offers → cheapest regular items
        items = [i for i in products.search(kw, sort="price", max_pages=1) if _ok(i, group) and i["price"] > 0.4][:3]
    return items


def plan(full=False, on_progress=lambda kw: None) -> dict:
    picks: dict[str, list[dict]] = {}
    for group, kws in GROUPS.items():
        found: list[dict] = []
        for kw in kws if full else kws[:QUICK]:
            found += _pick(kw, group, on_progress)
        # best deal first: highest % off, then cheapest
        found.sort(key=lambda i: (-i["pct"], i["price"]))
        seen, uniq = set(), []
        for i in found:
            if i["uid"] not in seen:
                seen.add(i["uid"]); uniq.append(i)
        picks[group] = uniq[:5]

    ideas, used = [], set()
    if not all(picks[g] for g in ("protein", "carb", "veg")):
        return {"picks": picks, "ideas": ideas}
    for sauce in picks["sauce"]:
        key, tpl = next(((k, t) for k, t in IDEAS if k in sauce["name"].lower()), (sauce["name"], "{p} with {c} & {v} in " + _short(sauce["name"])))
        if key in used:  # one idea per sauce style
            continue
        used.add(key)
        n = len(ideas)
        p, c, v = (picks[g][n % len(picks[g])] for g in ("protein", "carb", "veg"))
        parts = [p, c, v, sauce]
        cost = sum(i["price"] for i in parts)
        ideas.append({
            "idea": tpl.format(p=_short(p["name"]), c=_short(c["name"]), v=_short(v["name"])),
            "items": parts,
            "cost": round(cost, 2),
            "per_portion": round(cost / PORTIONS, 2),
        })
    return {"picks": picks, "ideas": ideas}


_NOISE = re.compile(
    r"(Sainsbury's|Taste the Difference|SO Organic|Stamford Street Co\.|by Sainsbury's|British|Fresh|Each|Pack|"
    r"\b\d+(\.\d+)?\s?(g|kg|ml|l|litre|x\s?\d+)\b|\b\d+\s?x\b|,)", re.I)


def _short(name: str) -> str:
    """'Sainsbury's 1kg British Chicken Breast Mini Fillets' -> 'Chicken Breast Mini Fillets'."""
    words = _NOISE.sub(" ", name).split()
    return " ".join(words[:5]) or name
