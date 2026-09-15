"""Department classifier for search results. The search API only exposes leaf categories ("Courgettes", "Beef mince",
"Cat treats & milk"), so we roll them up to Sainsbury's departments with ordered keyword rules. First match wins;
specific/non-food departments come first so "salmon cat food" is Pets, not Fish."""
import re

RULES: list[tuple[str, str]] = [
    ("Pets", r"\b(pet|cat|dog|kitten|puppy)s?\b"),
    ("Baby", r"\b(baby|nappies|toddler|infant)\b"),
    ("Household", r"\b(household|cleaning|laundry|toilet|kitchen roll|bin bags?|dishwash|washing up|foil|cling)\b"),
    ("Health & beauty", r"\b(medicine|health|vitamin|beauty|shampoo|toothpaste|deodorant|skincare|pharmacy)\b"),
    ("Drinks", r"\b(drinks?|juice|water|coffee|tea|squash|cola|lemonade|beer|wine|spirits|cider|smoothie)\b"),
    ("Frozen", r"\bfrozen\b|\bice cream\b|\blollies\b"),
    ("Bakery", r"\b(bread|bakery|rolls?|bagels?|wraps?|pitta|naan|croissants?|crumpets?|muffins?|bakes?)\b"),
    ("Fish", r"\b(fish|salmon|tuna|trout|cod|haddock|prawns?|seafood|mackerel|sea bass|scampi|calamari)\b"),
    ("Meat", r"\b(meat|chicken|beef|pork|lamb|turkey|mince|sausages?|bacon|ham|gammon|steak|duck|burgers?|meatballs?|kebabs?|poultry)\b"),
    ("Dairy & eggs", r"\b(dairy|eggs?|cheese|milk|yogh?urts?|butter|cream|skyr|kefir|cheddar|mozzarella|halloumi|feta)\b"),
    ("Fruit & veg", r"\b(fruit|veg(etables?)?|salads?|potato(es)?|carrots?|onions?|peppers?|tomato(es)?|courgettes?|broccoli|spinach|mushrooms?|avocados?|bananas?|apples?|berries|herbs?|garlic|leeks?|cabbage|lettuce|cucumber|sweetcorn|squash|kale|beans? sprouts?)\b"),
    ("Ready meals", r"\b(ready meals?|pizza|pies?|quiche|sides?|prepared|meal deal|sandwich(es)?|sushi|soups?)\b"),
    ("Snacks & treats", r"\b(snacks?|crisps|chocolates?|biscuits?|sweets|cakes?|cookies?|popcorn|nuts?|confectionery|desserts?|puddings?)\b"),
    ("Food cupboard", r"\b(pasta|rice|noodles?|sauces?|tinned|canned|cereals?|flour|oils?|spices?|beans|lentils|pulses|grains|couscous|quinoa|stock|pesto|passata|curry|cooking|condiments?|jams?|honey|spread|baking|world foods?|cupboard)\b"),
    ("Free from", r"\bfree from\b|\bgluten free\b|\bdairy free\b"),
    ("Vegetarian & plant based", r"\b(vegetarian|vegan|plant.based|tofu|meat.free)\b"),
]
_COMPILED = [(dept, re.compile(rx, re.I)) for dept, rx in RULES]


def classify(*texts: str) -> str:
    """Department for the given category names (most specific first) then product name; 'Other' if nothing matches."""
    for text in texts:
        for dept, rx in _COMPILED:
            if text and rx.search(text):
                return dept
    return "Other"


# ---- form: is this an ingredient you cook, something ready-made, or frozen? ----
# Staples you cook with (raw meat/fish, produce, block cheese, sausages, cooking sauces, bread) are ingredients.
_FROZEN = re.compile(r"\bfrozen\b|\bice cream\b|\bice lollies\b", re.I)
_READY = re.compile(
    r"\b(breaded|breadcrumbs?|crumbed|in crumb|battered|tempura|southern fried|crispy|crunchy|kyivs?|kievs?|goujons?|nuggets?|dippers?|grills?|chargrills?|popcorn chicken|bites|"
    r"cooked|roast(ed)?|smoked|ready|microwave|pots?|meal|pies?|pizza|quiche|sandwich(es)?|wraps?|sushi|kits?|katsu|schnitzel|escalopes?|"
    r"coated|glazed|stuffed|marinated|seasoned|dusted|buttermilk|sticky|bbq|parmigiana|en croute|mash(ed)?|slices|just cook|slow cooked|instant|"
    r"snacks?|crisps|biscuits?|cakes?|desserts?|puddings?|soups?|dips?|hummus|houmous|ham|salami|chorizo|pâté|pate|deli|dunkers|lunchables|"
    r"in a|with a)\b", re.I)


def form(*texts: str) -> str:
    """'frozen' | 'ready' | 'ingredient' from category names + product name."""
    blob = " ".join(t for t in texts if t)
    if _FROZEN.search(blob):
        return "frozen"
    return "ready" if _READY.search(blob) else "ingredient"
