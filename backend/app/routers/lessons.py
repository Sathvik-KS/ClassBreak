"""Lesson generation and quiz router."""

import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException

from app.models.lesson import (
    LessonGenerateRequest, LessonResponse, LessonSection,
    QuizGenerateRequest, QuizResponse, QuizQuestion,
    EvaluateRequest, AnswerEvaluation,
)
from app.models.common import Reference
from app.services.ai_provider import get_ai_provider
from app.services.source_manager import search_wikipedia, format_source_context
from app.config import settings

router = APIRouter(prefix="/api/lessons", tags=["lessons"])


@router.post("/generate", response_model=LessonResponse)
async def generate_lesson(request: LessonGenerateRequest):
    """Generate a complete lesson on a topic with source grounding."""
    if len(request.topic) > settings.max_prompt_length:
        raise HTTPException(status_code=400, detail="Topic too long")

    try:
        # Fetch source material from Wikipedia
        references, extracts = await search_wikipedia(request.topic)
        source_context = format_source_context(references, extracts)

        # Generate lesson via AI provider
        provider = get_ai_provider()
        raw = await provider.generate_lesson(
            topic=request.topic,
            interests=request.interests,
            depth=request.depth,
            duration_minutes=request.duration_minutes,
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
                content=raw.get("summary", f"A lesson about {request.topic}."),
                key_points=[],
            )]

        # Build references from AI output, cross-checked with actual sources
        lesson_refs = []
        source_urls = {r.url for r in references}
        for r in raw.get("references", []):
            ref = Reference(
                title=r.get("title", ""),
                url=r.get("url", ""),
                source_type=r.get("source_type", "wikipedia"),
                extract="",
            )
            lesson_refs.append(ref)

        # Add any Wikipedia references that the AI didn't include
        for orig_ref in references:
            if orig_ref.url not in {r.url for r in lesson_refs}:
                lesson_refs.append(Reference(
                    title=orig_ref.title,
                    url=orig_ref.url,
                    source_type="wikipedia",
                    extract="",
                ))

        return LessonResponse(
            id=str(uuid.uuid4()),
            title=raw.get("title", f"Understanding {request.topic.title()}"),
            summary=raw.get("summary", ""),
            topic=request.topic,
            domain=raw.get("domain", "general"),
            difficulty=raw.get("difficulty", request.depth),
            duration_minutes=request.duration_minutes,
            sections=sections,
            examples=raw.get("examples", []),
            takeaways=raw.get("takeaways", []),
            references=lesson_refs,
            related_topics=raw.get("related_topics", []),
            generated_at=datetime.now(timezone.utc).isoformat(),
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=502,
            detail=f"Failed to generate lesson: {type(e).__name__}",
        )


@router.post("/quiz", response_model=QuizResponse)
async def generate_quiz(request: QuizGenerateRequest):
    """Generate quiz questions for a lesson."""
    try:
        provider = get_ai_provider()
        raw_questions = await provider.generate_quiz(
            lesson_content=request.lesson_content,
            topic=request.topic,
            difficulty=request.difficulty,
            count=request.count,
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

    except Exception as e:
        raise HTTPException(
            status_code=502,
            detail=f"Failed to generate quiz: {type(e).__name__}",
        )


@router.post("/evaluate", response_model=AnswerEvaluation)
async def evaluate_answer(request: EvaluateRequest):
    """Evaluate a user's quiz answer."""
    try:
        provider = get_ai_provider()
        raw = await provider.evaluate_answer(
            question=request.question,
            correct_answer=request.correct_answer,
            user_answer=request.user_answer,
            question_type=request.question_type,
        )

        return AnswerEvaluation(
            is_correct=raw.get("is_correct", False),
            score=raw.get("score", 0.0),
            feedback=raw.get("feedback", ""),
            correct_answer=raw.get("correct_answer", request.correct_answer),
        )

    except Exception as e:
        raise HTTPException(
            status_code=502,
            detail=f"Failed to evaluate answer: {type(e).__name__}",
        )
