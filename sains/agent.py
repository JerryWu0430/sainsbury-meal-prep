"""pydantic-ai grocery agent. Provider is chosen by the SAINS_MODEL string (anthropic:/google-gla:/openai:/vercel:)."""
import os
from dataclasses import dataclass

os.environ.setdefault("PYDANTIC_AI_NO_BANNER", "1")
from datetime import date

from pydantic_ai import Agent, RunContext

from . import mealprep, products, store
from .config import KEY_ENV, MODEL, STORE_CODE


@dataclass
class Deps:
    store_code: str = STORE_CODE


class ConfigError(RuntimeError):
    pass


def check_model(model: str = MODEL) -> None:
    provider = model.split(":", 1)[0]
    env = KEY_ENV.get(provider)
    if env and not os.environ.get(env):
        raise ConfigError(f"SAINS_MODEL={model} needs {env} — set it in .env (local) or Vercel project env")


# Tool results are trimmed to what an LLM needs: fewer tokens, same decisions.
_KEEP = ("uid", "name", "price", "was", "pct", "unit", "promo", "nectar", "ends", "life")


def _trim(items: list[dict], limit: int) -> list[dict]:
    return [{k: i[k] for k in _KEEP if i.get(k) not in (None, "", 0, False)} for i in items[:limit]]


# model is passed at run time so importing this module never needs an API key
agent = Agent(deps_type=Deps, retries=2)


@agent.instructions
def _instructions(ctx: RunContext[Deps]) -> str:
    try:
        s = store.summary(store.info(ctx.deps.store_code))
        where = f"{s['name']} ({s['address']}), {s['type']} store, today {dict(s['hours']).get(date.today().strftime('%a'), '?')}"
    except Exception:
        where = f"store #{ctx.deps.store_code}"
    return f"""You are a sharp, frugal grocery assistant for someone who shops at Sainsbury's {where}.
Today is {date.today():%A %d %B %Y}. They cook in batches (meal prep, ~4 portions) and like discounts and new products.

Tools scrape Sainsbury's live with a 1.5 s throttle per keyword — be deliberate: pick a few specific keywords, not many broad ones (≤ 6 tool calls).
Prices are the online range; the shelf at this store may differ. "Nectar" prices need a Nectar card. Offers end on the date shown.
Answer in tight markdown: item, price (was → now, % off), promo, end date. For meal plans give a shopping list, total and per-portion cost, and 2-3 line method. Don't invent products or prices — only report what tools return."""


@agent.tool
def search_products(ctx: RunContext[Deps], keyword: str, offers_only: bool = False, new_only: bool = False, sort: str = "relevance", limit: int = 20) -> list[dict]:
    """Search the range by keyword. sort: relevance | price | -price | rating. Set offers_only for discounts, new_only for New In."""
    return _trim(products.search(keyword, offers=offers_only, new=new_only, sort=sort, max_pages=1), limit)


@agent.tool
def best_offers(ctx: RunContext[Deps], keywords: list[str], min_pct: int = 0, limit: int = 30) -> list[dict]:
    """Discounted items across several keywords, best % off first (each keyword = one scrape)."""
    seen, out = set(), []
    for k in keywords[:6]:
        for i in products.search(k, offers=True, max_pages=1):
            if i["uid"] not in seen and i["pct"] >= min_pct:
                seen.add(i["uid"]); out.append(i)
    out.sort(key=lambda i: (-i["pct"], i["price"] or 0))
    return _trim(out, limit)


@agent.tool
def meal_prep_plan(ctx: RunContext[Deps], full: bool = False) -> dict:
    """Rule-based batch-cook plan from current offers: picks per food group + 3 combined ideas with cost/portion."""
    p = mealprep.plan(full=full)
    return {"ideas": [{**i, "items": _trim(i["items"], 4)} for i in p["ideas"]], "picks": {g: _trim(v, 5) for g, v in p["picks"].items()}}


@agent.tool
def store_details(ctx: RunContext[Deps]) -> dict:
    """The shopper's store: hours, open-now, facilities (Bakery, Meal Deal, SmartShop…)."""
    s = store.summary(store.info(ctx.deps.store_code))
    s.pop("fsa", None)
    return s


@agent.tool_plain
def find_stores(query: str) -> dict:
    """Nearest Sainsbury's to a UK postcode, outcode or place name, with distance in km."""
    return store.find(query)


def ask(question: str, store_code: str = STORE_CODE, history=None, model: str = MODEL):
    check_model(model)
    return agent.run_sync(question, model=model, deps=Deps(store_code), message_history=history)


async def stream(question: str, store_code: str = STORE_CODE, model: str = MODEL):
    check_model(model)
    async with agent.run_stream(question, model=model, deps=Deps(store_code)) as result:
        async for delta in result.stream_text(delta=True):
            yield delta
