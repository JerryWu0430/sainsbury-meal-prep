"""Offline unit tests — no network. Scraper shape, title cleanup, geocode routing."""
from sains.mealprep import _short
from sains.products import slim
from sains.store import _km

RAW = {
    "product_uid": "1", "name": "Sainsbury's 1kg British Chicken Breast Mini Fillets", "full_url": "://www.sainsburys.co.uk/x",
    "retail_price": {"price": 5.0}, "unit_price": {"price": 5.0, "measure": "kg"}, "is_available": True,
    "promotions": [{"strap_line": "Save 1/3 with Nectar", "original_price": 7.5, "is_nectar": True, "end_date": "2026-09-14T23:00:00Z"}],
    "labels": [{"text": "Typical life 4 days"}], "assets": {"plp_image": "https://assets/img.jpg", "images": [{"sizes": [{"width": 140, "url": "https://assets/140.jpg"}]}]},
}


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
