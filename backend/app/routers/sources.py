"""Source search router for Wikipedia lookups."""

from fastapi import APIRouter, HTTPException, Query

from app.models.common import Reference
from app.services.source_manager import search_wikipedia

router = APIRouter(prefix="/api/sources", tags=["sources"])


class SourceSearchResponse:
    pass


@router.get("/search")
async def search_sources(q: str = Query(..., min_length=1, max_length=200)):
    """Search Wikipedia for source material on a topic."""
    try:
        references, extracts = await search_wikipedia(q, limit=5)
        return {
            "sources": [ref.model_dump() for ref in references],
            "extracts": extracts,
        }
    except Exception as e:
        raise HTTPException(
            status_code=502,
            detail=f"Source search failed: {type(e).__name__}",
        )
