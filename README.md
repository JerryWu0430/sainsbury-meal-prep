# sainsbury-meal-prep

CLI for Sainsbury's **Elephant & Castle** (40 New Kent Rd, SE1 6TJ, store #2499): what's on offer, what's new, and rule-based meal-prep ideas built from current discounts.

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
