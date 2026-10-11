"""Wikipedia source manager for fetching reference material."""

import httpx
from app.models.common import Reference


WIKIPEDIA_API_BASE = "https://en.wikipedia.org/api/rest_v1"
USER_AGENT = "ClassBreak/1.0 (Learning App; contact: classbreak@example.com)"


async def search_wikipedia(query: str, limit: int = 3) -> tuple[list[Reference], list[str]]:
    """Search Wikipedia for a topic and return references and text extracts.
    
    Returns:
        Tuple of (references, extracts) where extracts are the text content.
    """
    references: list[Reference] = []
    extracts: list[str] = []

    async with httpx.AsyncClient(timeout=10.0) as client:
        # Try getting a direct page summary first
        try:
            resp = await client.get(
                f"{WIKIPEDIA_API_BASE}/page/summary/{query}",
                headers={"User-Agent": USER_AGENT},
                follow_redirects=True,
            )
            if resp.status_code == 200:
                data = resp.json()
                if data.get("type") == "standard" and data.get("extract"):
                    ref = Reference(
                        title=data.get("title", query),
                        url=data.get("content_urls", {}).get("desktop", {}).get("page", f"https://en.wikipedia.org/wiki/{query}"),
                        source_type="wikipedia",
                        extract=data["extract"],
                    )
                    references.append(ref)
                    extracts.append(data["extract"])
        except (httpx.HTTPError, KeyError):
            pass  # Proceed to search fallback

        # If no direct result or need more, try related pages
        if len(references) < limit:
            try:
                resp = await client.get(
                    f"{WIKIPEDIA_API_BASE}/page/related/{query}",
                    headers={"User-Agent": USER_AGENT},
                    follow_redirects=True,
                )
                if resp.status_code == 200:
                    data = resp.json()
                    for page in data.get("pages", [])[:limit - len(references)]:
                        if page.get("extract"):
                            ref = Reference(
                                title=page.get("title", ""),
                                url=page.get("content_urls", {}).get("desktop", {}).get("page", ""),
                                source_type="wikipedia",
                                extract=page["extract"],
                            )
                            references.append(ref)
                            extracts.append(page["extract"])
            except (httpx.HTTPError, KeyError):
                pass

    return references, extracts


def format_source_context(references: list[Reference], extracts: list[str]) -> str:
    """Format references and extracts into a source context string for prompts."""
    if not references:
        return "No source material available. Base the lesson on your general knowledge and clearly state this."

    parts = []
    for ref, extract in zip(references, extracts):
        parts.append(f"SOURCE: {ref.title}\nURL: {ref.url}\nCONTENT:\n{extract}\n")
    return "\n---\n".join(parts)
