"""Offline unit tests — no network. Scraper shape, title cleanup, geocode routing."""
from sains.mealprep import _short
from sains.categories import classify
from sains.products import _catmap, slim

TREE = [{"id": "all", "name": "All Categories", "children": [
    {"id": "820666", "name": "Meat", "value": 231, "children": [{"id": "812519", "name": "Chicken", "children": [{"id": "310865", "name": "Chicken breast and fillet"}]}]},
    {"id": "999", "name": "Eat more fish", "value": 3, "children": [{"id": "310865", "name": "Chicken breast and fillet"}]}]}]
from sains.store import _km

RAW = {
    "product_uid": "1", "name": "Sainsbury's 1kg British Chicken Breast Mini Fillets", "full_url": "://www.sainsburys.co.uk/x",
    "retail_price": {"price": 5.0}, "unit_price": {"price": 5.0, "measure": "kg"}, "is_available": True,
    "promotions": [{"strap_line": "Save 1/3 with Nectar", "original_price": 7.5, "is_nectar": True, "end_date": "2026-09-14T23:00:00Z"}],
    "labels": [{"text": "Typical life 4 days"}], "categories": [{"id": "310865", "name": "Chicken breast and fillet"}, {"id": "412353", "name": "Special offers"}], "assets": {"plp_image": "https://assets/img.jpg", "images": [{"sizes": [{"width": 140, "url": "https://assets/140.jpg"}]}]},
}


def test_catmap_and_category():
    m = _catmap(TREE)
    assert m["812519"] == ("Meat", "Chicken", 231) and m["820666"] == ("Meat", "Meat", 231) and m["*"] == "Meat"
    s = slim(RAW, m)
    assert (s["category"], s["subcategory"]) == ("Meat", "Chicken")  # 'Eat more fish' also claims the id but is tiny
    unknown = slim({**RAW, "categories": [{"id": "1", "name": "Wings"}], "name": "Chicken wings 500g"}, m)
    assert (unknown["category"], unknown["subcategory"]) == ("Meat", "Wings")
    assert _catmap(TREE[0]["children"])["*"] == "Meat"  # unwrapped root works too


def test_classify():
    assert classify("Cat treats & milk", "Salmon cat food") == "Pets"
    assert classify("Salmon, tuna & trout") == "Fish"
    assert classify("Courgettes", "Exotic vegetables") == "Fruit & veg"
    assert classify("Beef mince") == "Meat"
    assert classify("Dried pasta", "Barilla Fusilli 500g") == "Food cupboard"
    assert classify("Zzz") == "Other"
    assert slim(RAW)["category"] == "Meat"  # no tree → classifier on leaf names


def test_slim_promo_fields():
    s = slim(RAW)
    assert (s["price"], s["was"], s["pct"], s["nectar"]) == (5.0, 7.5, 33, True)
    assert s["ends"] == "2026-09-14" and s["unit"] == "£5.0/kg" and s["life"] == "Typical life 4 days"
    assert s["url"].startswith("https://") and s["thumb"] == "https://assets/140.jpg"


def test_slim_hides_fake_was():
    raw = {**RAW, "promotions": [{"strap_line": "Meal Deal for £5.50", "original_price": 5.0}]}
    assert slim(raw)["was"] is None and slim(raw)["pct"] == 0


def test_short_title():
    assert _short("Sainsbury's 1kg British Chicken Breast Mini Fillets") == "Chicken Breast Mini Fillets"
    assert _short("Barilla Fusilli Pasta 500g") == "Barilla Fusilli Pasta"
    assert _short("Sainsbury's Red Sweet Pointed Pepper Each, Taste the Difference") == "Red Sweet Pointed Pepper"


def test_km():
    assert round(_km(51.4947, -0.0988, 51.4947, -0.0988), 3) == 0
    assert 0.5 < _km(51.4947, -0.0988, 51.5007, -0.1246) < 3  # E&C → Waterloo-ish
