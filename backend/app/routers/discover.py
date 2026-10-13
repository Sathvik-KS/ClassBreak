"""Discovery feed router."""

import logging
import uuid

from fastapi import APIRouter, HTTPException, Request

from app.config import settings
from app.models.lesson import FeedRequest, FeedResponse, FeedItem
from app.rate_limit import limiter
from app.services.ai_provider import get_ai_provider

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/discover", tags=["discover"])


@router.post("/feed", response_model=FeedResponse)
@limiter.limit(settings.rate_limit)
async def get_feed(request: Request, payload: FeedRequest):
    """Generate a personalized discovery feed."""
    try:
        provider = get_ai_provider()
        raw_items = await provider.generate_feed(
            interests=payload.interests,
            excluded=payload.excluded_topics,
            history_ids=payload.history_ids,
            count=payload.count,
        )

        items = []
        for raw in raw_items:
            try:
                item = FeedItem(
                    id=raw.get("id", str(uuid.uuid4())),
                    title=raw.get("title", "Untitled"),
                    hook=raw.get("hook", ""),
                    topic=raw.get("topic", ""),
                    domain=raw.get("domain", "general"),
                    difficulty=raw.get("difficulty", "beginner"),
                    estimated_minutes=raw.get("estimated_minutes", 5),
                )
                items.append(item)
            except Exception:
                continue  # Skip malformed items

        return FeedResponse(items=items)

    except Exception:
        # Log the real cause server-side; return a generic client message.
        logger.exception("Failed to generate feed")
        raise HTTPException(status_code=502, detail="Feed generation failed")
