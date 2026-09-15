"""Dish bank → match each ingredient to the best current product → cost, macros and value per dish.
Deterministic and explainable: exact-token matching on names (must/avoid), form-aware, cheapest per gram wins, offers break ties."""
import json
import math
import re
from pathlib import Path

from . import products

BANK = Path(__file__).resolve().parents[1] / "data" / "dishes.json"
MACROS = ("kcal", "protein", "carbs", "fat")


def load(path: Path = BANK) -> dict:
    return json.loads(Path(path).read_text())


def _unit_per_g(unit: str) -> float | None:
    """'£5.0/kg' -> £/g ; '£1.2/100g' -> £/g ; per-each or blank -> None"""
    m = re.match(r"£([\d.]+)/(kg|l|litre|100g|100ml)", unit or "")
    return None if not m else float(m.group(1)) / (100 if m.group(2).startswith("100") else 1000)


def _tokens_ok(name: str, spec: dict) -> bool:
    n = name.lower()
    must, avoid = spec.get("must", []), spec.get("avoid", [])
    has = [t in n for t in must]
    if must and not (any(has) if spec.get("any") else all(has)):
        return False
    return not any(t in n for t in avoid)


def pick(spec: dict, candidates: list[dict], grams: float) -> dict | None:
    """Best product for an ingredient: right form, name tokens ok, then cheapest for the grams needed (offer breaks ties)."""
    want_form = spec.get("form", "ingredient")
    ok = [c for c in candidates if c.get("available") and c.get("price") and (c.get("form") or "ingredient") in (want_form, "ingredient") and _tokens_ok(c["name"], spec)]
    if not ok:
        return None

    def cost(c):
        per_g = _unit_per_g(c.get("unit", ""))
        return per_g * grams if per_g else c["price"]  # per-each → one pack

    def pack_g(c):
        per_g = _unit_per_g(c.get("unit", ""))
        return c["price"] / per_g if per_g else None

    # prefer sensibly sized packs (≤ 5× what the dish needs) so 300 g of rice doesn't resolve to a 10 kg sack
    fit = [c for c in ok if pack_g(c) is None or pack_g(c) <= max(5 * grams, 1000)] or ok
    best = min(fit, key=lambda c: (round(cost(c), 2), -c.get("pct", 0)))
    return {"product": best, "cost": round(cost(best), 2), "proportional": _unit_per_g(best.get("unit", "")) is not None}


def cost_dish(dish: dict, bank: dict, catalogue: dict[str, list[dict]]) -> dict:
    """catalogue: ingredient ref → candidate products (from a search for its keyword). Returns cost, macros per portion, matches."""
    lines, missing, total = [], [], 0.0
    macros = dict.fromkeys(MACROS, 0.0)
    for ref, grams in dish["ingredients"]:
        spec = bank["ingredients"][ref]
        for k, v in zip(MACROS, spec["per100"]):
            macros[k] += v * grams / 100
        m = pick(spec, catalogue.get(ref, []), grams)
        if m:
            total += m["cost"]
            lines.append({"ref": ref, "grams": grams, **m})
        else:
            missing.append(ref)
    n = dish["portions"]
    per = {k: round(v / n, 1) for k, v in macros.items()}
    on_offer = sum(1 for l in lines if l["product"].get("pct", 0) > 0)
    return {**{k: dish[k] for k in ("id", "name", "cuisine", "portions", "tags", "method")}, "lines": lines, "missing": missing,
            "cost": round(total, 2), "per_portion": round(total / n, 2), "macros": per,
            "protein_per_pound": round(per["protein"] * n / total, 1) if total else 0, "on_offer": on_offer, "n_ingredients": len(dish["ingredients"])}


def catalogue_for(bank: dict, refs: set[str] | None = None, on_progress=lambda kw: None) -> dict[str, list[dict]]:
    """One search per distinct ingredient keyword (CDN-cached on Vercel)."""
    out: dict[str, list[dict]] = {}
    by_kw: dict[str, list[str]] = {}
    for ref, spec in bank["ingredients"].items():
        if refs is None or ref in refs:
            by_kw.setdefault(spec["kw"], []).append(ref)
    for kw, refs_ in by_kw.items():
        on_progress(kw)
        items = products.search(kw, max_pages=1)
        for r in refs_:
            out[r] = items
    return out


def rank(bank: dict, catalogue: dict[str, list[dict]], cuisine: str | None = None, sort: str = "per_portion") -> list[dict]:
    dishes = [cost_dish(d, bank, catalogue) for d in bank["dishes"] if not cuisine or d["cuisine"].lower() == cuisine.lower()]
    key = {"per_portion": lambda d: (d["missing"] != [], d["per_portion"]),
           "protein": lambda d: (d["missing"] != [], -d["protein_per_pound"]),
           "offers": lambda d: (d["missing"] != [], -d["on_offer"] / max(1, d["n_ingredients"]), d["per_portion"])}[sort]
    return sorted(dishes, key=key)


def plan_totals(selected: list[tuple[dict, int]], bank: dict | None = None) -> dict:
    """Selected (costed dish, batches) → merged shopping list, total £, portions, macro averages per portion."""
    bank = bank or load()
    shop: dict[str, dict] = {}
    portions = cost = 0.0
    macros = dict.fromkeys(MACROS, 0.0)
    for d, batches in selected:
        portions += d["portions"] * batches
        cost += d["cost"] * batches
        for k in MACROS:
            macros[k] += d["macros"][k] * d["portions"] * batches
        for l in d["lines"]:
            p = l["product"]
            row = shop.setdefault(p["uid"], {"product": p, "grams": 0.0, "cost": 0.0, "for": [], "role": None})
            row["grams"] += l["grams"] * batches
            row["cost"] += l["cost"] * batches
            row["role"] = row["role"] or bank["ingredients"][l["ref"]]["role"]
            if d["name"] not in row["for"]:
                row["for"].append(d["name"])
    for row in shop.values():  # whole packs: proportional lines round up to packs where we know the pack price
        price = row["product"].get("price") or 0
        row["packs"] = max(1, math.ceil(row["cost"] / price - 1e-9)) if price else 1
        # long-life pantry staple (sauce/oil/spice) where the plan uses under a third of a pack — you probably have it
        row["pantry"] = row["role"] in ("sauce", "other") and price > 0 and row["cost"] / price < 0.34
    rows = list(shop.values())
    packs_cost = sum(r["packs"] * (r["product"].get("price") or 0) for r in rows if not r["pantry"])
    pantry_cost = sum(r["packs"] * (r["product"].get("price") or 0) for r in rows if r["pantry"])
    return {"portions": portions, "cost": round(cost, 2), "per_portion": round(cost / portions, 2) if portions else 0,
            "packs_cost": round(packs_cost, 2), "pantry_cost": round(pantry_cost, 2),
            "macros_per_portion": {k: round(v / portions, 1) for k, v in macros.items()} if portions else {},
            "shopping": sorted(shop.values(), key=lambda r: -r["cost"])}
