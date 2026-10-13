"""AI tutor chat router."""

import logging

from fastapi import APIRouter, HTTPException, Request

from app.config import settings
from app.models.lesson import TutorChatRequest, TutorResponse
from app.models.common import Reference
from app.rate_limit import limiter
from app.services.ai_provider import get_ai_provider

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/tutor", tags=["tutor"])


@router.post("/chat", response_model=TutorResponse)
@limiter.limit(settings.rate_limit)
async def tutor_chat(request: Request, payload: TutorChatRequest):
    """Handle an AI tutor conversation turn."""
    try:
        # Format conversation history
        history_lines = []
        for msg in payload.messages[-10:]:  # Keep last 10 messages for context
            role_label = "Learner" if msg.role == "user" else "Tutor"
            history_lines.append(f"{role_label}: {msg.content}")
        conversation_history = "\n".join(history_lines)

        provider = get_ai_provider()
        raw = await provider.tutor_chat(
            lesson_context=payload.lesson_context,
            conversation_history=conversation_history,
            question=payload.question,
        )

        refs = []
        for r in raw.get("references", []):
            if not isinstance(r, dict):
                continue
            title = str(r.get("title") or "").strip()
            url = str(r.get("url") or "").strip()
            # Structural check: only present plausible links to the user.
            if not title or not url.lower().startswith(("http://", "https://")):
                continue
            refs.append(Reference(
                title=title,
                url=url,
                source_type="provided",
            ))

        return TutorResponse(
            answer=raw.get("answer", "I'm not sure how to answer that. Could you rephrase?"),
            follow_up_suggestions=raw.get("follow_up_suggestions", []),
            references=refs,
        )

    except Exception:
        logger.exception("Tutor chat failed")
        raise HTTPException(status_code=502, detail="Tutor unavailable")
