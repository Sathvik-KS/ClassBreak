"""Tests for AI provider factory and mock provider."""

import pytest
from app.services.ai_provider import get_ai_provider, AIProvider
from app.services.mock_provider import MockProvider


def test_get_provider_returns_mock_by_default():
    """Without API key, factory returns MockProvider."""
    provider = get_ai_provider()
    assert isinstance(provider, MockProvider)


@pytest.mark.anyio
async def test_mock_generate_lesson():
    """MockProvider generates a valid lesson."""
    provider = MockProvider()
    result = await provider.generate_lesson(
        topic="test topic",
        interests=["science"],
        depth="beginner",
        duration_minutes=5,
        source_context="Test source.",
    )
    assert "title" in result
    assert "sections" in result
    assert len(result["sections"]) > 0


@pytest.mark.anyio
async def test_mock_generate_feed():
    """MockProvider generates feed items."""
    provider = MockProvider()
    result = await provider.generate_feed(
        interests=["psychology"],
        excluded=[],
        history_ids=[],
        count=5,
    )
    assert len(result) > 0
    assert "title" in result[0]
    assert "hook" in result[0]


@pytest.mark.anyio
async def test_mock_tutor_chat():
    """MockProvider responds to tutor questions."""
    provider = MockProvider()
    result = await provider.tutor_chat(
        lesson_context="A lesson about attention.",
        conversation_history="",
        question="Why is attention important?",
    )
    assert "answer" in result
    assert len(result["answer"]) > 0


@pytest.mark.anyio
async def test_mock_generate_quiz():
    """MockProvider generates quiz questions."""
    provider = MockProvider()
    result = await provider.generate_quiz(
        lesson_content="Lesson about attention.",
        topic="attention",
        difficulty="beginner",
        count=3,
    )
    assert len(result) > 0
    assert "question" in result[0]


@pytest.mark.anyio
async def test_mock_evaluate_correct():
    """MockProvider evaluates correct MC answers."""
    provider = MockProvider()
    result = await provider.evaluate_answer(
        question="Test?",
        correct_answer="Answer A",
        user_answer="Answer A",
        question_type="multiple_choice",
    )
    assert result["is_correct"] is True
    assert result["score"] == 1.0


@pytest.mark.anyio
async def test_mock_evaluate_wrong():
    """MockProvider evaluates wrong MC answers."""
    provider = MockProvider()
    result = await provider.evaluate_answer(
        question="Test?",
        correct_answer="Answer A",
        user_answer="Answer B",
        question_type="multiple_choice",
    )
    assert result["is_correct"] is False
    assert result["score"] == 0.0


@pytest.mark.anyio
async def test_mock_evaluate_open_ended():
    """MockProvider gives partial credit for open-ended answers."""
    provider = MockProvider()
    result = await provider.evaluate_answer(
        question="What is attention?",
        correct_answer="ability to focus on specific stimuli",
        user_answer="the ability to focus on things",
        question_type="open_ended",
    )
    assert 0 <= result["score"] <= 1
    assert "correct_answer" in result
