import os

from dotenv import load_dotenv

load_dotenv()  # local .env; on Vercel use project env vars
load_dotenv(".env.local")  # `vercel env pull` output (REDIS_URL etc.)

# Default store: Sainsbury's Elephant & Castle, 40 New Kent Rd, SE1 6TJ. Override w/ SAINS_STORE or `sains stores <postcode>`.
STORE_CODE = os.environ.get("SAINS_STORE", "2499")

# LLM for `sains ask` / /api/ask — pydantic-ai model string, e.g.
#   anthropic:claude-sonnet-5           (ANTHROPIC_API_KEY)
#   google-gla:gemini-2.5-flash         (GEMINI_API_KEY)
#   openai:gpt-5                        (OPENAI_API_KEY)
#   vercel:anthropic/claude-sonnet-5    (VERCEL_AI_GATEWAY_API_KEY) — one key, any provider
MODEL = os.environ.get("SAINS_MODEL", "anthropic:claude-sonnet-5")
KEY_ENV = {"anthropic": "ANTHROPIC_API_KEY", "google-gla": "GEMINI_API_KEY", "google-vertex": "GOOGLE_APPLICATION_CREDENTIALS",
           "openai": "OPENAI_API_KEY", "vercel": "VERCEL_AI_GATEWAY_API_KEY"}

# Politeness limits — Sainsbury's sits behind Akamai bot manager; a 403 means back off.
MIN_GAP_S = 1.5      # min seconds between live requests (+ jitter)
PAGE_SIZE = 60       # server hard cap
MAX_PAGES = 2        # per query, default (120 items)
CACHE_TTL_S = 6 * 3600
