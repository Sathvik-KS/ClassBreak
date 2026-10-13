"""Lesson generation and quiz router."""

import logging
import uuid
from datetime import datetime, timezone
from urllib.parse import urlparse

from fastapi import APIRouter, HTTPException, Request

from app.models.lesson import (
    LessonGenerateRequest, LessonResponse, LessonSection,
    QuizGenerateRequest, QuizResponse, QuizQuestion,
    EvaluateRequest, AnswerEvaluation,
)
from app.models.common import Reference
from app.rate_limit import limiter
from app.services.ai_provider import get_ai_provider
from app.services.source_manager import search_wikipedia, format_source_context
from app.config import settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/lessons", tags=["lessons"])


def _normalize_url(url: str) -> str:
    """Structural normalization for URL comparison.

    Returns "" when the URL is not a usable http(s) URL with a host.
    Scheme/host are lowercased; trailing slash, query, and fragment are
    dropped so the same article cited in different forms compares equal.
    """
    try:
        parsed = urlparse((url or "").strip())
    except ValueError:
        return ""
    if parsed.scheme not in ("http", "https") or not parsed.netloc:
        return ""
    return f"{parsed.scheme.lower()}://{parsed.netloc.lower()}{parsed.path.rstrip('/')}"


def validate_references(
    ai_references: list, fetched: list[Reference]
) -> list[Reference]:
    """Structurally validate AI-provided references against fetched sources.

    Rules:
    - Dropped: non-dict entries, empty titles, malformed URLs (deduped by
      normalized URL).
    - Marked ``source_type="wikipedia"``: normalized URL matches a source we
      actually fetched — grounded in retrieved material.
    - Marked ``source_type="provided"``: structurally valid but NOT present in
      the fetched sources — honestly labeled as model-supplied, not verified.
    - Retrieved sources the model did not cite are appended.

    This is *structural* validation only (does this citation refer to a source
    we retrieved?). It does NOT verify that a source semantically supports any
    claim — no fact-checking is performed or implied.
    """
    fetched_by_url = {
        norm: ref
        for ref in fetched
        if (norm := _normalize_url(ref.url))
    }

    validated: list[Reference] = []
    seen: set[str] = set()

    for raw_ref in ai_references or []:
        if not isinstance(raw_ref, dict):
            continue
        title = str(raw_ref.get("title") or "").strip()
        raw_url = str(raw_ref.get("url") or "").strip()
        norm = _normalize_url(raw_url)
        if not title or not norm or norm in seen:
            continue
        seen.add(norm)
        matched = fetched_by_url.get(norm)
        validated.append(Reference(
            title=title,
            url=raw_url,
            source_type="wikipedia" if matched else "provided",
            extract=matched.extract if matched else "",
        ))

    # Append retrieved sources the model didn't cite (deduped by URL).
    for ref in fetched:
        norm = _normalize_url(ref.url)
        if norm and norm not in seen:
            seen.add(norm)
            validated.append(ref)

    return validated


@router.post("/generate", response_model=LessonResponse)
@limiter.limit(settings.rate_limit)
async def generate_lesson(request: Request, payload: LessonGenerateRequest):
    """Generate a complete lesson on a topic with source grounding."""
    if len(payload.topic) > settings.max_prompt_length:
        raise HTTPException(status_code=400, detail="Topic too long")

    try:
        # Fetch source material from Wikipedia (fails gracefully to empty)
        references, extracts = await search_wikipedia(payload.topic)
        source_context = format_source_context(references, extracts)

        # Generate lesson via AI provider
        provider = get_ai_provider()
        raw = await provider.generate_lesson(
            topic=payload.topic,
            interests=payload.interests,
            depth=payload.depth,
            duration_minutes=payload.duration_minutes,
            source_context=source_context,
        )

        # Validate and build response
        sections = []
        for s in raw.get("sections", []):
            sections.append(LessonSection(
                heading=s.get("heading", ""),
                content=s.get("content", ""),
                key_points=s.get("key_points", []),
            ))

        if not sections:
            sections = [LessonSection(
                heading="Overview",
                content=raw.get("summary", f"A lesson about {payload.topic}."),
                key_points=[],
            )]

        # Structurally validate AI-cited references against fetched sources;
        # see validate_references() for exactly what is and isn't verified.
        lesson_refs = validate_references(raw.get("references", []), references)

        return LessonResponse(
            id=str(uuid.uuid4()),
            title=raw.get("title", f"Understanding {payload.topic.title()}"),
            summary=raw.get("summary", ""),
            topic=payload.topic,
            domain=raw.get("domain", "general"),
            difficulty=raw.get("difficulty", payload.depth),
            duration_minutes=payload.duration_minutes,
            sections=sections,
            examples=raw.get("examples", []),
            takeaways=raw.get("takeaways", []),
            references=lesson_refs,
            related_topics=raw.get("related_topics", []),
            generated_at=datetime.now(timezone.utc).isoformat(),
        )

    except HTTPException:
        raise
    except Exception:
        logger.exception("Failed to generate lesson")
        raise HTTPException(status_code=502, detail="Lesson generation failed")


@router.post("/quiz", response_model=QuizResponse)
@limiter.limit(settings.rate_limit)
async def generate_quiz(request: Request, payload: QuizGenerateRequest):
    """Generate quiz questions for a lesson."""
    try:
        provider = get_ai_provider()
        raw_questions = await provider.generate_quiz(
            lesson_content=payload.lesson_content,
            topic=payload.topic,
            difficulty=payload.difficulty,
            count=payload.count,
        )

        questions = []
        for q in raw_questions:
            try:
                questions.append(QuizQuestion(
                    id=q.get("id", str(uuid.uuid4())),
                    question=q.get("question", ""),
                    options=q.get("options", []),
                    correct_answer=q.get("correct_answer", ""),
                    explanation=q.get("explanation", ""),
                    question_type=q.get("question_type", "multiple_choice"),
                ))
            except Exception:
                continue

        return QuizResponse(questions=questions)

    except Exception:
        logger.exception("Failed to generate quiz")
        raise HTTPException(status_code=502, detail="Quiz generation failed")


@router.post("/evaluate", response_model=AnswerEvaluation)
@limiter.limit(settings.rate_limit)
async def evaluate_answer(request: Request, payload: EvaluateRequest):
    """Evaluate a user's quiz answer."""
    try:
        provider = get_ai_provider()
        raw = await provider.evaluate_answer(
            question=payload.question,
            correct_answer=payload.correct_answer,
            user_answer=payload.user_answer,
            question_type=payload.question_type,
        )

        return AnswerEvaluation(
            is_correct=raw.get("is_correct", False),
            score=raw.get("score", 0.0),
            feedback=raw.get("feedback", ""),
            correct_answer=raw.get("correct_answer", payload.correct_answer),
        )

    except Exception:
        logger.exception("Failed to evaluate answer")
        raise HTTPException(status_code=502, detail="Answer evaluation failed")
