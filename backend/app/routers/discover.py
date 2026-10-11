"""Discovery feed router."""

import uuid
from fastapi import APIRouter, HTTPException
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.models.lesson import FeedRequest, FeedResponse, FeedItem
from app.services.ai_provider import get_ai_provider

router = APIRouter(prefix="/api/discover", tags=["discover"])
limiter = Limiter(key_func=get_remote_address)


@router.post("/feed", response_model=FeedResponse)
async def get_feed(request: FeedRequest):
    """Generate a personalized discovery feed."""
    try:
        provider = get_ai_provider()
        raw_items = await provider.generate_feed(
            interests=request.interests,
            excluded=request.excluded_topics,
            history_ids=request.history_ids,
            count=request.count,
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

    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Failed to generate feed: {type(e).__name__}")
