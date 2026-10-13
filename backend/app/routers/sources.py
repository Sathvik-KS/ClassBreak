"""Source search router for Wikipedia lookups."""

import logging

from fastapi import APIRouter, HTTPException, Query, Request

from app.config import settings
from app.rate_limit import limiter
from app.services.source_manager import search_wikipedia

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/sources", tags=["sources"])


@router.get("/search")
@limiter.limit(settings.rate_limit_read)
async def search_sources(request: Request, q: str = Query(..., min_length=1, max_length=200)):
    """Search Wikipedia for source material on a topic."""
    try:
        references, extracts = await search_wikipedia(q, limit=5)
        return {
            "sources": [ref.model_dump() for ref in references],
            "extracts": extracts,
        }
    except Exception:
        logger.exception("Source search failed")
        raise HTTPException(status_code=502, detail="Source search failed")
