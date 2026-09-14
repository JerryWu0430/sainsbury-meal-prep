# Sainsbury's Local, 40 New Kent Rd, Elephant & Castle, SE1 6TJ
STORE_CODE = "2499"
LAT, LON = 51.4947, -0.0988

# Politeness limits — Sainsbury's sits behind Akamai bot manager; a 403 means back off.
MIN_GAP_S = 1.5      # min seconds between live requests (+ jitter)
PAGE_SIZE = 60       # server hard cap
MAX_PAGES = 2        # per query, default (120 items)
CACHE_TTL_S = 6 * 3600
