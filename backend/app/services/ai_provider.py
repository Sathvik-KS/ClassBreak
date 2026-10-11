"""Abstract AI provider interface and factory."""

from abc import ABC, abstractmethod
from app.models.lesson import (
    LessonResponse, FeedItem, TutorResponse, QuizQuestion, AnswerEvaluation,
)


class AIProvider(ABC):
    """Abstract interface for AI content generation.
    
    All AI functionality goes through this interface, making it easy to
    swap providers (Gemini, OpenAI, local models, etc.) without changing
    application logic.
    """

    @abstractmethod
    async def generate_lesson(
        self,
        topic: str,
        interests: list[str],
        depth: str,
        duration_minutes: int,
        source_context: str,
    ) -> dict:
        """Generate a structured lesson. Returns raw dict to be validated."""
        ...

    @abstractmethod
    async def generate_feed(
        self,
        interests: list[str],
        excluded: list[str],
        history_ids: list[str],
        count: int,
    ) -> list[dict]:
        """Generate discovery feed items. Returns list of raw dicts."""
        ...

    @abstractmethod
    async def tutor_chat(
        self,
        lesson_context: str,
        conversation_history: str,
        question: str,
    ) -> dict:
        """Answer a tutoring question. Returns raw dict."""
        ...

    @abstractmethod
    async def generate_quiz(
        self,
        lesson_content: str,
        topic: str,
        difficulty: str,
        count: int,
    ) -> list[dict]:
        """Generate quiz questions. Returns list of raw dicts."""
        ...

    @abstractmethod
    async def evaluate_answer(
        self,
        question: str,
        correct_answer: str,
        user_answer: str,
        question_type: str,
    ) -> dict:
        """Evaluate a user's answer. Returns raw dict."""
        ...


def get_ai_provider() -> AIProvider:
    """Factory function that returns the appropriate AI provider.
    
    Uses mock provider when no API key is configured, 
    Gemini provider when key is available.
    """
    from app.config import settings

    provider_name = settings.effective_ai_provider

    if provider_name == "gemini":
        from app.services.gemini import GeminiProvider
        return GeminiProvider(api_key=settings.gemini_api_key)
    else:
        from app.services.mock_provider import MockProvider
        return MockProvider()
