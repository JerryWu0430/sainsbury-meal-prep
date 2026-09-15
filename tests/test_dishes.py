from sains import dishes

BANK = dishes.load()
CAT = {
    "chicken thigh": [
        {"uid": "1", "name": "Sainsbury's British Chicken Thigh Fillets 640g", "price": 4.0, "unit": "£6.25/kg", "pct": 0, "form": "ingredient", "available": True},
        {"uid": "2", "name": "Sainsbury's Cooked Chicken Thighs 300g", "price": 2.0, "unit": "£6.67/kg", "pct": 50, "form": "ready", "available": True},
        {"uid": "3", "name": "Sainsbury's Chicken Thighs Skin On 1kg", "price": 3.5, "unit": "£3.5/kg", "pct": 25, "form": "ingredient", "available": True},
    ],
    "basmati rice": [{"uid": "4", "name": "Tilda Basmati Rice 1kg", "price": 3.0, "unit": "£3/kg", "pct": 0, "form": "ingredient", "available": True},
                     {"uid": "6", "name": "Akash Basmati Rice 10kg", "price": 12.0, "unit": "£1.2/kg", "pct": 42, "form": "ingredient", "available": True},
                     {"uid": "5", "name": "Tilda Microwave Basmati Rice 250g", "price": 1.0, "unit": "£4/kg", "pct": 50, "form": "ready", "available": True}],
}


def test_bank_integrity():
    refs = set(BANK["ingredients"])
    for d in BANK["dishes"]:
        assert d["portions"] > 0 and all(r in refs for r, _ in d["ingredients"]), d["id"]
    assert len({d["id"] for d in BANK["dishes"]}) == len(BANK["dishes"])


def test_pick_prefers_cheapest_ingredient_form():
    m = dishes.pick(BANK["ingredients"]["chicken thigh"], CAT["chicken thigh"], 600)
    assert m["product"]["uid"] == "3" and m["cost"] == 2.1  # £3.5/kg × 0.6 kg; cooked thighs excluded (ready)
    r = dishes.pick(BANK["ingredients"]["basmati rice"], CAT["basmati rice"], 300)
    assert r["product"]["uid"] == "4"  # microwave pouch excluded; 10 kg sack skipped as > 5× the 300 g needed


def test_cost_dish_and_totals():
    dish = next(d for d in BANK["dishes"] if d["id"] == "chicken-tikka-rice")
    c = dishes.cost_dish(dish, BANK, CAT)
    assert c["missing"] and c["cost"] > 0 and c["macros"]["protein"] > 30 and c["portions"] == 4
    t = dishes.plan_totals([(c, 2)])
    assert t["portions"] == 8 and t["cost"] == round(c["cost"] * 2, 2) and t["shopping"][0]["packs"] >= 1
