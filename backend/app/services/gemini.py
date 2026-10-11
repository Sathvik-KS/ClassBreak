"""Google Gemini AI provider implementation."""

import json
import logging
from google import genai
from google.genai import types

from app.services.ai_provider import AIProvider
from app.services import prompts

logger = logging.getLogger(__name__)

MODEL_NAME = "gemini-2.0-flash"


class GeminiProvider(AIProvider):
    """AI provider using Google Gemini API."""

    def __init__(self, api_key: str):
        if not api_key:
            raise ValueError("Gemini API key is required")
        self.client = genai.Client(api_key=api_key)

    async def _generate_json(self, system_prompt: str, user_prompt: str) -> dict:
        """Send a prompt to Gemini and parse the JSON response."""
        try:
            response = self.client.models.generate_content(
                model=MODEL_NAME,
                contents=user_prompt,
                config=types.GenerateContentConfig(
                    system_instruction=system_prompt,
                    response_mime_type="application/json",
                    temperature=0.7,
                    max_output_tokens=4096,
                ),
            )
            text = response.text
            if not text:
                raise ValueError("Empty response from Gemini")
            return json.loads(text)
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse Gemini JSON response: {e}")
            raise ValueError(f"AI returned invalid JSON: {e}")
        except Exception as e:
            logger.error(f"Gemini API error: {type(e).__name__}: {e}")
            raise

    async def generate_lesson(
        self, topic: str, interests: list[str], depth: str,
        duration_minutes: int, source_context: str,
    ) -> dict:
        prompt = prompts.LESSON_GENERATION_PROMPT.format(
            topic=topic,
            difficulty=depth,
            duration_minutes=duration_minutes,
            interests=", ".join(interests) if interests else "general knowledge",
            source_context=source_context,
        )
        return await self._generate_json(prompts.LESSON_SYSTEM_PROMPT, prompt)

    async def generate_feed(
        self, interests: list[str], excluded: list[str],
        history_ids: list[str], count: int,
    ) -> list[dict]:
        prompt = prompts.FEED_GENERATION_PROMPT.format(
            count=count,
            interests=", ".join(interests) if interests else "science, technology, psychology, history",
            excluded=", ".join(excluded) if excluded else "none",
            history_ids=", ".join(history_ids[-20:]) if history_ids else "none",
        )
        result = await self._generate_json(prompts.FEED_SYSTEM_PROMPT, prompt)
        return result.get("items", [])

    async def tutor_chat(
        self, lesson_context: str, conversation_history: str, question: str,
    ) -> dict:
        prompt = prompts.TUTOR_CHAT_PROMPT.format(
            lesson_context=lesson_context or "No specific lesson context provided.",
            conversation_history=conversation_history or "No previous conversation.",
            question=question,
        )
        return await self._generate_json(prompts.TUTOR_SYSTEM_PROMPT, prompt)

    async def generate_quiz(
        self, lesson_content: str, topic: str, difficulty: str, count: int,
    ) -> list[dict]:
        prompt = prompts.QUIZ_GENERATION_PROMPT.format(
            count=count,
            lesson_content=lesson_content[:3000],  # Limit context size
            topic=topic,
            difficulty=difficulty,
        )
        result = await self._generate_json(prompts.QUIZ_SYSTEM_PROMPT, prompt)
        return result.get("questions", [])

    async def evaluate_answer(
        self, question: str, correct_answer: str,
        user_answer: str, question_type: str,
    ) -> dict:
        prompt = prompts.EVALUATE_PROMPT.format(
            question=question,
            correct_answer=correct_answer,
            user_answer=user_answer,
            question_type=question_type,
        )
        return await self._generate_json(prompts.EVALUATE_SYSTEM_PROMPT, prompt)
