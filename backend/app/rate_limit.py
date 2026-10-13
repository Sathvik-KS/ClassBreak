"""Shared slowapi rate limiter.

Scope and limitations (be accurate when documenting this):
- In-memory, per-process counters. State resets on restart and is NOT shared
  between workers/instances — this is single-process cost control for a
  stateless, unauthenticated service, NOT distributed or production-grade
  abuse protection.
- Applied via @limiter.limit(...) on expensive AI-facing routes only;
  /api/health is deliberately unlimited so monitoring is never blocked.
- Limits come from settings.rate_limit (AI POSTs) and settings.rate_limit_read
  (source search GET); configure via the RATE_LIMIT / RATE_LIMIT_READ env vars.
- slowapi's headers_enabled stays off (its FastAPI integration then expects a
  `response: Response` endpoint param we don't use); the 429 handler in
  app/main.py sets the Retry-After header directly instead.
"""

from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
