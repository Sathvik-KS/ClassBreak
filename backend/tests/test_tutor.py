"""Tests for the AI tutor chat endpoint."""

import pytest
from httpx import AsyncClient


@pytest.mark.anyio
async def test_tutor_basic_question(client: AsyncClient):
    """Tutor answers a basic question."""
    resp = await client.post("/api/tutor/chat", json={
        "lesson_context": "This lesson is about selective attention and the cocktail party effect.",
        "question": "Why can I hear my name in a noisy room?",
    })
    assert resp.status_code == 200
    data = resp.json()
    assert "answer" in data
    assert len(data["answer"]) > 0
    assert "follow_up_suggestions" in data


@pytest.mark.anyio
async def test_tutor_with_history(client: AsyncClient):
    """Tutor works with conversation history."""
    resp = await client.post("/api/tutor/chat", json={
        "lesson_context": "Lesson about attention.",
        "messages": [
            {"role": "user", "content": "What is attention?"},
            {"role": "assistant", "content": "Attention is the ability to focus on specific stimuli."},
        ],
        "question": "Can you explain more?",
    })
    assert resp.status_code == 200
    assert "answer" in resp.json()


@pytest.mark.anyio
async def test_tutor_empty_question(client: AsyncClient):
    """Tutor rejects empty questions."""
    resp = await client.post("/api/tutor/chat", json={
        "question": "",
    })
    assert resp.status_code == 422


@pytest.mark.anyio
async def test_tutor_no_context(client: AsyncClient):
    """Tutor works even without lesson context."""
    resp = await client.post("/api/tutor/chat", json={
        "question": "What is quantum entanglement?",
    })
    assert resp.status_code == 200
    assert "answer" in resp.json()
