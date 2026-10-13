"""Tests for GeminiProvider async behavior (no network, no API key needed).

The provider is exercised with a fake client to verify:
- the synchronous SDK call runs off the event loop (worker thread),
- a bounded timeout so an unreachable provider can't hang a request,
- malformed responses raise instead of returning misleading data.
"""

import asyncio
import threading
import time
from types import SimpleNamespace

import pytest

from app.config import settings
from app.services.gemini import GeminiProvider


def _provider_with_fake_client(text: str = '{"ok": true}', delay: float = 0.0):
    """GeminiProvider without invoking genai.Client (no network/credentials)."""
    calls = {"thread_id": None, "kwargs": None}

    def generate_content(**kwargs):
        calls["thread_id"] = threading.get_ident()
        calls["kwargs"] = kwargs
        if delay:
            time.sleep(delay)
        return SimpleNamespace(text=text)

    provider = object.__new__(GeminiProvider)
    provider.client = SimpleNamespace(models=SimpleNamespace(generate_content=generate_content))
    return provider, calls


@pytest.mark.anyio
async def test_generate_json_returns_parsed_dict():
    provider, calls = _provider_with_fake_client('{"answer": "hi"}')
    result = await provider._generate_json("system", "user")
    assert result == {"answer": "hi"}
    # The SDK call received the configured model and both prompts.
    assert calls["kwargs"]["model"]
    assert calls["kwargs"]["contents"] == "user"


@pytest.mark.anyio
async def test_generate_json_runs_sdk_call_in_worker_thread():
    """The blocking SDK call must not execute on the event-loop thread."""
    provider, calls = _provider_with_fake_client()
    await provider._generate_json("system", "user")
    assert calls["thread_id"] is not None
    assert calls["thread_id"] != threading.get_ident()


@pytest.mark.anyio
async def test_generate_json_enforces_timeout(monkeypatch):
    """A hung provider call is abandoned after settings.gemini_timeout."""
    monkeypatch.setattr(settings, "gemini_timeout", 0.05)
    provider, _ = _provider_with_fake_client(delay=5.0)

    start = time.monotonic()
    with pytest.raises((TimeoutError, asyncio.TimeoutError)):
        await provider._generate_json("system", "user")
    elapsed = time.monotonic() - start
    assert elapsed < 2.0  # bounded by timeout, not the 5s fake delay


@pytest.mark.anyio
async def test_generate_json_invalid_json_raises():
    provider, _ = _provider_with_fake_client(text="this is not json {")
    with pytest.raises(ValueError, match="invalid JSON"):
        await provider._generate_json("system", "user")


@pytest.mark.anyio
async def test_generate_json_empty_response_raises():
    provider, _ = _provider_with_fake_client(text="")
    with pytest.raises(ValueError, match="Empty response"):
        await provider._generate_json("system", "user")


def test_gemini_provider_requires_key():
    with pytest.raises(ValueError, match="API key"):
        GeminiProvider(api_key="")
