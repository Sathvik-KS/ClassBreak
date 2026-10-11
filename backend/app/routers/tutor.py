"""AI tutor chat router."""

from fastapi import APIRouter, HTTPException

from app.models.lesson import TutorChatRequest, TutorResponse
from app.models.common import Reference
from app.services.ai_provider import get_ai_provider

router = APIRouter(prefix="/api/tutor", tags=["tutor"])


@router.post("/chat", response_model=TutorResponse)
async def tutor_chat(request: TutorChatRequest):
    """Handle an AI tutor conversation turn."""
    try:
        # Format conversation history
        history_lines = []
        for msg in request.messages[-10:]:  # Keep last 10 messages for context
            role_label = "Learner" if msg.role == "user" else "Tutor"
            history_lines.append(f"{role_label}: {msg.content}")
        conversation_history = "\n".join(history_lines)

        provider = get_ai_provider()
        raw = await provider.tutor_chat(
            lesson_context=request.lesson_context,
            conversation_history=conversation_history,
            question=request.question,
        )

        refs = []
        for r in raw.get("references", []):
            refs.append(Reference(
                title=r.get("title", ""),
                url=r.get("url", ""),
                source_type=r.get("source_type", "wikipedia"),
            ))

        return TutorResponse(
            answer=raw.get("answer", "I'm not sure how to answer that. Could you rephrase?"),
            follow_up_suggestions=raw.get("follow_up_suggestions", []),
            references=refs,
        )

    except Exception as e:
        raise HTTPException(
            status_code=502,
            detail=f"Tutor unavailable: {type(e).__name__}",
        )
