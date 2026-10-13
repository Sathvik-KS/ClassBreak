"""Test configuration and fixtures."""

import json
from pathlib import Path

import httpx
import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.services import source_manager

FIXTURES_DIR = Path(__file__).parent / "fixtures"


def load_wikipedia_fixture(name: str) -> object:
    """Load a recorded Wikipedia API response (captured 2026-10-11)."""
    return json.loads((FIXTURES_DIR / name).read_text(encoding="utf-8"))


def offline_wikipedia_handler(request: httpx.Request) -> httpx.Response:
    """Serve recorded Wikipedia API fixtures so tests never hit the network."""
    if "/page/summary/" in request.url.path:
        return httpx.Response(200, json=load_wikipedia_fixture("summary_selective_attention.json"))
    action = request.url.params.get("action")
    if action == "opensearch":
        return httpx.Response(200, json=load_wikipedia_fixture("opensearch_selective_attention.json"))
    if action == "query":
        return httpx.Response(200, json=load_wikipedia_fixture("extracts_selective_attention.json"))
    return httpx.Response(404, json={"error": "unexpected Wikipedia request in tests"})


@pytest.fixture(autouse=True)
def offline_wikipedia(monkeypatch):
    """Route source_manager HTTP through recorded fixtures (no live Wikipedia)."""
    def factory() -> httpx.AsyncClient:
        return httpx.AsyncClient(transport=httpx.MockTransport(offline_wikipedia_handler))

    monkeypatch.setattr(source_manager, "_make_client", factory)
    return factory


@pytest.fixture
def anyio_backend():
    return "asyncio"


@pytest.fixture(autouse=True)
def reset_rate_limiter():
    """Isolate rate-limit counters between tests.

    The limiter uses shared in-memory storage for the whole process; without
    a reset, requests made by earlier tests count against later tests'
    per-route budgets (all tests share one client IP).
    """
    storage = app.state.limiter._storage
    storage.reset()
    yield
    storage.reset()


@pytest.fixture
async def client():
    """Async HTTP test client."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
