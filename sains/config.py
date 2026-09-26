import os

from dotenv import load_dotenv

load_dotenv()  # local .env; on Vercel use project env vars
load_dotenv(".env.local")  # `vercel env pull` output (REDIS_URL etc.)

# Default store: Sainsbury's Elephant & Castle, 40 New Kent Rd, SE1 6TJ. Override w/ SAINS_STORE or `sains stores <postcode>`.
STORE_CODE = os.environ.get("SAINS_STORE", "2499")

# LLM for `sains ask` / /api/ask — pydantic-ai model string; OpenAI only (OPENAI_API_KEY). `test` = fake model, no key.
MODEL = os.environ.get("SAINS_MODEL", "openai:gpt-5.4-mini")
KEY_ENV = {"openai": "OPENAI_API_KEY"}

# Politeness limits — Sainsbury's sits behind Akamai bot manager; a 403 means back off.
MIN_GAP_S = 1.5      # min seconds between live requests (+ jitter)
PAGE_SIZE = 60       # server hard cap
MAX_PAGES = 2        # per query, default (120 items)
CACHE_TTL_S = 6 * 3600
