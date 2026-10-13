"""Tests for rate limiting on AI-facing endpoints.

The limiter is in-memory with a per-route, per-IP scope (slowapi default:
scope = endpoint). Limits come from settings (default 30/minute for AI POSTs,
60/minute for the sources GET). These tests are deterministic: they consume
the configured budget rather than waiting on wall-clock windows, and conftest
resets limiter storage between tests.
"""

import pytest
from httpx import AsyncClient

from app.config import settings


def _limit_amount(limit_value: str) -> int:
    """Parse the numeric amount from a slowapi limit string like '30/minute'."""
    return int(limit_value.split("/")[0].strip())


@pytest.mark.anyio
async def test_tutor_over_limit_returns_429_with_detail(client: AsyncClient):
    """The route enforces the limit and returns the app's error contract."""
    limit = _limit_amount(settings.rate_limit)
    body = {"question": "Why do we hear our own name?"}

    statuses = []
    last = None
    for _ in range(limit + 1):
        last = await client.post("/api/tutor/chat", json=body)
        statuses.append(last.status_code)

    # Everything up to the limit passes; the next request is rejected.
    assert statuses[:limit] == [200] * limit
    assert last is not None
    assert last.status_code == 429

    data = last.json()
    assert "detail" in data
    assert "rate limit" in data["detail"].lower()
    # slowapi injects rate-limit headers on the 429 response.
    assert "retry-after" in {k.lower() for k in last.headers}


@pytest.mark.anyio
async def test_lesson_generate_over_limit_returns_429(client: AsyncClient):
    """Lesson generation (the most expensive route) is rate limited too."""
    limit = _limit_amount(settings.rate_limit)
    last = None
    for _ in range(limit + 1):
        last = await client.post("/api/lessons/generate", json={"topic": "selective attention"})
    assert last is not None
    assert last.status_code == 429
    assert "detail" in last.json()


@pytest.mark.anyio
async def test_health_is_not_rate_limited(client: AsyncClient):
    """Monitoring must never be blocked by the AI budget."""
    limit = _limit_amount(settings.rate_limit)
    for _ in range(limit + 5):
        resp = await client.get("/api/health")
        assert resp.status_code == 200


@pytest.mark.anyio
async def test_rate_limit_recovers_after_storage_reset(client: AsyncClient):
    """A 429 does not permanently wedge the route (counter is time-windowed).

    Verified without waiting: resetting the in-memory counter (what the window
    expiry does in production) makes the route serve again immediately.
    """
    limit = _limit_amount(settings.rate_limit)
    for _ in range(limit + 1):
        await client.post("/api/tutor/chat", json={"question": "q"})

    from app.main import app
    app.state.limiter._storage.reset()

    resp = await client.post("/api/tutor/chat", json={"question": "q"})
    assert resp.status_code == 200
