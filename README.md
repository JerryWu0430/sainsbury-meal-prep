# sainsbury-meal-prep

Sainsbury's **Elephant & Castle** by default (40 New Kent Rd, SE1 6TJ, store #2499) — or any store you pick: what's on offer, what's new, rule-based meal-prep ideas, and an LLM agent that can use all of it. Ships as a CLI, a JSON API, and a Next.js/shadcn dashboard.

## Agent (`sains ask`, `/ask`)

[pydantic-ai](https://ai.pydantic.dev) agent with tools over the scraper: `search_products`, `best_offers`, `meal_prep_plan`, `store_details`, `find_stores`. Instructions carry the chosen store, today's hours and the scraping etiquette (≤ 6 tool calls). The **provider is one env var** — pydantic-ai's model string is the universal adapter:

```sh
cp .env.example .env
SAINS_MODEL=anthropic:claude-sonnet-5        ANTHROPIC_API_KEY=…
SAINS_MODEL=google-gla:gemini-2.5-flash      GEMINI_API_KEY=…
SAINS_MODEL=vercel:anthropic/claude-sonnet-5 VERCEL_AI_GATEWAY_API_KEY=…   # one key, any provider
SAINS_MODEL=test                             # no key: pydantic-ai's fake model, still runs the tools

uv run sains ask "plan 4 lunches under £12 from today's offers"
uv run sains chat                            # multi-turn
```

Web: `/ask` streams the answer (`POST /api/ask {question, store}` → `text/plain` chunks). Without a key the API answers `503` with the exact env var to set. On Vercel add `SAINS_MODEL` + the key under Project → Environment Variables.

## Location

```sh
uv run sains stores "SE1 6TJ"      # postcode / outcode ("SW9") / place ("Brixton") → nearest stores + km
uv run sains store 6028            # hours/facilities for that store
SAINS_STORE=6028 uv run sains ask …
```

Geocoding: postcodes.io for UK postcodes/outcodes, Nominatim for place names (cached 30 days). The dashboard's sidebar has **Change** → picker; the choice persists in `localStorage` and is sent to `/api/store` and `/api/ask`. Product/offer data is the national online range regardless of store — only hours, facilities and the agent's context are store-specific.

## Web (Vercel)

```
api/index.py      FastAPI → Vercel Python function   /api/store?store= /api/stores?q= /api/offers /api/new /api/search /api/mealprep /api/item/{uid} POST /api/ask
app/, components/ Next.js 16 + TS + shadcn (Base UI) dashboard — sidebar nav: Offers · New in · Meal prep · Search · Ask
                  Instrument Sans/Serif, product thumbnails hotlinked from assets.sainsburys-groceries.co.uk (plain S3)
```

```sh
npm install && uv sync
npm run dev          # next dev :3000 + uvicorn :8000 (rewrites proxy /api/* in dev)
```

Deploys on push to `main`. Responses carry `Cache-Control: s-maxage=21600` so Vercel's CDN absorbs repeat hits; the Python function itself caches in `/tmp` (best-effort). Datacenter IPs may trip Akamai more than a laptop — if `/api/*` starts returning 5xx with "HTTP 403 after retries", back off.

## CLI

```sh
uv sync
uv run sains store                 # hours, facilities, open-now
uv run sains offers                # discounted staples, best % off first
uv run sains offers chicken rice --min 25
uv run sains new                   # "New In" items
uv run sains search salmon -o      # keyword search (-o offers only, -n new only, --sort price)
uv run sains mealprep [--full]     # batch-cook ideas from current offers
uv run sains item 8259101          # raw product JSON
uv run sains --json offers         # any command as JSON
uv run sains cache-clear
```

## How it scrapes (and why it's gentle)

No HTML parsing. Two public JSON endpoints the website itself uses:

| Endpoint | Use |
|---|---|
| `www.sainsburys.co.uk/groceries-api/gol-services/product/v1/product?filter[keyword]=…` | search; `filter[nav_Filter-Your-Results]=Offers` / `new`; `sort_order=price\|-price\|-relevance\|-customer rating`; `page_size` **capped at 60** |
| `…/product/v1/product/{uid}` | product detail |
| `stores.sainsburys.co.uk/api/v1/stores/{code}?fields=slfe-details-2.21&api_client_id=slfe` | store hours/facilities |

Notes from probing:
- `www.sainsburys.co.uk` sits behind **Akamai Bot Manager**: plain `curl`/`requests` → 403. `curl_cffi` with Chrome TLS impersonation → 200. A 403 mid-run means *stop*, not retry harder.
- `robots.txt` does **not** disallow `/groceries-api/` (it blocks trolley/checkout/account paths only).
- Unknown filter values are silently ignored (you get the unfiltered set) — only `Offers` and `new` are real.
- Empty keyword returns nothing; browsing by category id isn't exposed in a usable way.
- **No public per-store stock API.** Product data = online delivery range. Store-level "what's actually on the shelf at E&C" isn't available; `store` gives hours/facilities (Bakery, Meal Deal, SmartShop, …) so you know the format.

Guardrails in `sains/config.py`:
- ≥1.5 s + jitter between live requests, max 3 tries with exponential backoff on 403/429
- 6 h on-disk cache (`~/.cache/sains/`) so repeated commands cost zero requests
- default 1 page (60 items) per keyword; `--pages` max 5
- `mealprep` quick mode ≈ 8 requests cold; `--full` ≈ 21

Personal use only; be nice to their servers.
