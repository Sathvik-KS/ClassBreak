"""Tests for lesson generation, quiz, and evaluation endpoints."""

import pytest
from httpx import AsyncClient


@pytest.mark.anyio
async def test_generate_lesson(client: AsyncClient):
    """Lesson generation returns a complete lesson."""
    resp = await client.post("/api/lessons/generate", json={
        "topic": "selective attention",
        "duration_minutes": 5,
        "depth": "beginner",
        "interests": ["psychology"],
    })
    assert resp.status_code == 200
    data = resp.json()
    assert "id" in data
    assert "title" in data
    assert "sections" in data
    assert len(data["sections"]) > 0
    assert "references" in data
    assert "takeaways" in data
    assert "related_topics" in data
    assert data["topic"] == "selective attention"


@pytest.mark.anyio
async def test_generate_lesson_short(client: AsyncClient):
    """2-minute lesson generates successfully."""
    resp = await client.post("/api/lessons/generate", json={
        "topic": "photosynthesis",
        "duration_minutes": 2,
        "depth": "beginner",
    })
    assert resp.status_code == 200
    assert len(resp.json()["sections"]) > 0


@pytest.mark.anyio
async def test_generate_lesson_invalid_depth(client: AsyncClient):
    """Lesson rejects invalid depth."""
    resp = await client.post("/api/lessons/generate", json={
        "topic": "test",
        "depth": "expert",
    })
    assert resp.status_code == 422


@pytest.mark.anyio
async def test_generate_lesson_empty_topic(client: AsyncClient):
    """Lesson rejects empty topic."""
    resp = await client.post("/api/lessons/generate", json={
        "topic": "",
    })
    assert resp.status_code == 422


@pytest.mark.anyio
async def test_generate_quiz(client: AsyncClient):
    """Quiz generation returns valid questions."""
    resp = await client.post("/api/lessons/quiz", json={
        "lesson_content": "The cocktail party effect is the ability to focus on one conversation in a noisy room. It was studied by Colin Cherry in 1953.",
        "topic": "selective attention",
        "difficulty": "beginner",
        "count": 3,
    })
    assert resp.status_code == 200
    data = resp.json()
    assert "questions" in data
    assert len(data["questions"]) > 0
    q = data["questions"][0]
    assert "question" in q
    assert "correct_answer" in q
    assert "options" in q


@pytest.mark.anyio
async def test_evaluate_correct_answer(client: AsyncClient):
    """Correct answer evaluation returns is_correct=True."""
    resp = await client.post("/api/lessons/evaluate", json={
        "question": "Who studied the cocktail party effect?",
        "correct_answer": "Colin Cherry",
        "user_answer": "Colin Cherry",
        "question_type": "multiple_choice",
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["is_correct"] is True
    assert data["score"] == 1.0


@pytest.mark.anyio
async def test_evaluate_wrong_answer(client: AsyncClient):
    """Wrong answer evaluation returns is_correct=False."""
    resp = await client.post("/api/lessons/evaluate", json={
        "question": "Who studied the cocktail party effect?",
        "correct_answer": "Colin Cherry",
        "user_answer": "Daniel Kahneman",
        "question_type": "multiple_choice",
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["is_correct"] is False
    assert data["score"] == 0.0


@pytest.mark.anyio
async def test_evaluate_missing_fields(client: AsyncClient):
    """Evaluate rejects missing required fields."""
    resp = await client.post("/api/lessons/evaluate", json={
        "question": "test",
    })
    assert resp.status_code == 422
