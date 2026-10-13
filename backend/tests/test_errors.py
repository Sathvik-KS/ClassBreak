"""Tests for consistent, non-leaky error responses and source-failure behavior."""

import pytest
from httpx import AsyncClient


class _ExplodingProvider:
    async def generate_lesson(self, **kwargs):
        raise RuntimeError("internal-secret-path/creds-leak")

    async def generate_quiz(self, **kwargs):
        raise RuntimeError("internal-secret-path/creds-leak")

    async def evaluate_answer(self, **kwargs):
        raise RuntimeError("internal-secret-path/creds-leak")

    async def generate_feed(self, **kwargs):
        raise RuntimeError("internal-secret-path/creds-leak")

    async def tutor_chat(self, **kwargs):
        raise RuntimeError("internal-secret-path/creds-leak")


@pytest.mark.anyio
async def test_provider_failure_returns_generic_502(client: AsyncClient, monkeypatch):
    """Provider exceptions never leak class names or messages to the client."""
    import app.routers.tutor as tutor_mod

    monkeypatch.setattr(tutor_mod, "get_ai_provider", lambda: _ExplodingProvider())
    resp = await client.post(
        "/api/tutor/chat", json={"lesson_context": "ctx", "question": "q"}
    )
    assert resp.status_code == 502
    body = resp.text
    assert resp.json() == {"detail": "Tutor unavailable"}
    assert "internal-secret-path" not in body
    assert "RuntimeError" not in body


@pytest.mark.anyio
async def test_feed_provider_failure_generic_502(client: AsyncClient, monkeypatch):
    import app.routers.discover as discover_mod

    monkeypatch.setattr(discover_mod, "get_ai_provider", lambda: _ExplodingProvider())
    resp = await client.post("/api/discover/feed", json={})
    assert resp.status_code == 502
    assert resp.json() == {"detail": "Feed generation failed"}
    assert "RuntimeError" not in resp.text


@pytest.mark.anyio
async def test_lesson_provider_failure_generic_502(client: AsyncClient, monkeypatch):
    import app.routers.lessons as lessons_mod

    monkeypatch.setattr(lessons_mod, "get_ai_provider", lambda: _ExplodingProvider())
    resp = await client.post("/api/lessons/generate", json={"topic": "selective attention"})
    assert resp.status_code == 502
    assert resp.json() == {"detail": "Lesson generation failed"}
    assert "RuntimeError" not in resp.text


@pytest.mark.anyio
async def test_quiz_provider_failure_generic_502(client: AsyncClient, monkeypatch):
    import app.routers.lessons as lessons_mod

    monkeypatch.setattr(lessons_mod, "get_ai_provider", lambda: _ExplodingProvider())
    resp = await client.post(
        "/api/lessons/quiz",
        json={"lesson_content": "some lesson content", "topic": "t"},
    )
    assert resp.status_code == 502
    assert resp.json() == {"detail": "Quiz generation failed"}


@pytest.mark.anyio
async def test_evaluate_provider_failure_generic_502(client: AsyncClient, monkeypatch):
    import app.routers.lessons as lessons_mod

    monkeypatch.setattr(lessons_mod, "get_ai_provider", lambda: _ExplodingProvider())
    resp = await client.post(
        "/api/lessons/evaluate",
        json={"question": "q", "correct_answer": "a", "user_answer": "b"},
    )
    assert resp.status_code == 502
    assert resp.json() == {"detail": "Answer evaluation failed"}


@pytest.mark.anyio
async def test_lesson_generation_without_sources_still_succeeds(
    client: AsyncClient, monkeypatch
):
    """Source retrieval failure degrades gracefully (empty sources), and any
    model-supplied citations are honestly labeled 'provided' — nothing is
    presented as a fetched Wikipedia source that wasn't fetched."""
    import app.routers.lessons as lessons_mod

    async def _no_sources(query: str, limit: int = 3):
        return [], []

    monkeypatch.setattr(lessons_mod, "search_wikipedia", _no_sources)
    resp = await client.post("/api/lessons/generate", json={"topic": "selective attention"})
    assert resp.status_code == 200
    refs = resp.json()["references"]
    assert all(r["source_type"] == "provided" for r in refs)


@pytest.mark.anyio
async def test_sources_endpoint_failure_returns_502(client: AsyncClient, monkeypatch):
    import app.routers.sources as sources_mod

    async def _boom(query: str, limit: int = 3):
        raise ConnectionError("network unreachable")

    monkeypatch.setattr(sources_mod, "search_wikipedia", _boom)
    resp = await client.get("/api/sources/search", params={"q": "anything"})
    assert resp.status_code == 502
    assert resp.json() == {"detail": "Source search failed"}
    assert "ConnectionError" not in resp.text
