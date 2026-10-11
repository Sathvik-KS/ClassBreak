"""Wikipedia source manager for fetching reference material.

The primary article comes from the REST ``/page/summary/`` endpoint;
additional related sources come from the MediaWiki Action API
(``action=opensearch`` for candidate titles, ``action=query&prop=extracts``
for their intro text). The older REST ``/page/related/`` endpoint was
decommissioned upstream (phabricator T376297, HTTP 403) and is not used.

All failures (timeouts, HTTP errors, malformed payloads, missing articles)
degrade gracefully to fewer sources instead of raising.
"""

from urllib.parse import quote

import httpx
from app.models.common import Reference


WIKIPEDIA_API_BASE = "https://en.wikipedia.org/api/rest_v1"
WIKIPEDIA_ACTION_API = "https://en.wikipedia.org/w/api.php"
USER_AGENT = "ClassBreak/1.0 (Learning App; contact: classbreak@example.com)"
REQUEST_TIMEOUT = 10.0
# MediaWiki's extracts API returns at most 20 pages per request (anonymous).
MAX_RELATED_TITLES = 20
# Bound related-article extracts so prompt context (and AI cost) stays small.
RELATED_EXTRACT_CHARS = 1000


def _make_client() -> httpx.AsyncClient:
    """Create the HTTP client used for Wikipedia calls.

    Kept as a seam so tests can route requests through
    ``httpx.MockTransport`` instead of the live network.
    """
    return httpx.AsyncClient(timeout=REQUEST_TIMEOUT)


def _article_url(title: str) -> str:
    """Build the canonical article URL for a page title."""
    return f"https://en.wikipedia.org/wiki/{quote(title.replace(' ', '_'))}"


async def _fetch_summary(client: httpx.AsyncClient, query: str) -> Reference | None:
    """Fetch the primary article summary, or None on any failure."""
    try:
        resp = await client.get(
            f"{WIKIPEDIA_API_BASE}/page/summary/{quote(query, safe='')}",
            headers={"User-Agent": USER_AGENT},
            follow_redirects=True,
        )
    except httpx.HTTPError:
        return None
    if resp.status_code != 200:
        return None
    try:
        data = resp.json()
    except ValueError:
        return None
    if not isinstance(data, dict) or data.get("type") != "standard":
        return None
    extract = data.get("extract")
    if not isinstance(extract, str) or not extract:
        return None

    title = data.get("title")
    if not isinstance(title, str) or not title:
        title = query
    url = None
    content_urls = data.get("content_urls")
    if isinstance(content_urls, dict):
        desktop = content_urls.get("desktop")
        if isinstance(desktop, dict):
            url = desktop.get("page")
    if not isinstance(url, str) or not url:
        url = _article_url(title)
    return Reference(title=title, url=url, source_type="wikipedia", extract=extract)


async def _fetch_related_titles(client: httpx.AsyncClient, query: str, count: int) -> list[str]:
    """Find candidate article titles for related sources (MediaWiki OpenSearch)."""
    try:
        resp = await client.get(
            WIKIPEDIA_ACTION_API,
            params={
                "action": "opensearch",
                "namespace": "0",
                "limit": str(count),
                "format": "json",
                "search": query,
            },
            headers={"User-Agent": USER_AGENT},
        )
    except httpx.HTTPError:
        return []
    if resp.status_code != 200:
        return []
    try:
        data = resp.json()
    except ValueError:
        return []
    # OpenSearch replies with a 4-element array: [query, [titles], [descriptions], [urls]]
    if not isinstance(data, list) or len(data) < 2 or not isinstance(data[1], list):
        return []
    titles = [t for t in data[1] if isinstance(t, str) and t]
    return titles[: min(count, MAX_RELATED_TITLES)]


async def _fetch_extracts(client: httpx.AsyncClient, titles: list[str]) -> dict[str, tuple[str, str]]:
    """Map each requested title to (final title, intro extract).

    Redirects and normalizations are resolved (``redirects=1``), pages marked
    ``missing`` and pages with an empty extract are skipped.
    """
    if not titles:
        return {}
    try:
        resp = await client.get(
            WIKIPEDIA_ACTION_API,
            params={
                "action": "query",
                "format": "json",
                "formatversion": "2",
                "prop": "extracts",
                "exintro": "1",
                "explaintext": "1",
                "exchars": str(RELATED_EXTRACT_CHARS),
                "exlimit": str(min(len(titles), MAX_RELATED_TITLES)),
                "redirects": "1",
                "titles": "|".join(titles[:MAX_RELATED_TITLES]),
            },
            headers={"User-Agent": USER_AGENT},
        )
    except httpx.HTTPError:
        return {}
    if resp.status_code != 200:
        return {}
    try:
        data = resp.json()
    except ValueError:
        return {}
    if not isinstance(data, dict):
        return {}
    query_block = data.get("query")
    if not isinstance(query_block, dict):
        return {}

    # Build a from -> to map covering both normalization and redirect hops.
    resolution: dict[str, str] = {}
    for key in ("normalized", "redirects"):
        items = query_block.get(key)
        if isinstance(items, list):
            for item in items:
                if (
                    isinstance(item, dict)
                    and isinstance(item.get("from"), str)
                    and isinstance(item.get("to"), str)
                ):
                    resolution[item["from"]] = item["to"]

    def resolve(title: str) -> str:
        seen: set[str] = set()
        while title in resolution and title not in seen:
            seen.add(title)
            title = resolution[title]
        return title

    pages: dict[str, dict] = {}
    page_list = query_block.get("pages")
    if isinstance(page_list, list):
        for page in page_list:
            if isinstance(page, dict) and isinstance(page.get("title"), str):
                pages[page["title"]] = page

    extracts: dict[str, tuple[str, str]] = {}
    for requested in titles:
        final_title = resolve(requested)
        page = pages.get(final_title)
        if page is None or page.get("missing"):
            continue
        extract = page.get("extract")
        if not isinstance(extract, str) or not extract:
            continue
        extracts[requested] = (final_title, extract)
    return extracts


async def _fetch_related(
    client: httpx.AsyncClient,
    query: str,
    needed: int,
    exclude: set[str],
) -> list[Reference]:
    """Build up to ``needed`` related references, skipping excluded titles."""
    if needed <= 0:
        return []
    # Ask for a couple of extra candidates: one often duplicates the primary
    # article (search results lead with the queried page).
    candidates = await _fetch_related_titles(client, query, needed + 2)
    if not candidates:
        return []
    extracts = await _fetch_extracts(client, candidates)

    references: list[Reference] = []
    seen: set[str] = set(exclude)
    for requested in candidates:
        hit = extracts.get(requested)
        if hit is None:
            continue
        final_title, extract = hit
        url = _article_url(final_title)
        if final_title.casefold() in seen or url in seen:
            continue
        seen.add(final_title.casefold())
        seen.add(url)
        references.append(
            Reference(
                title=final_title,
                url=url,
                source_type="wikipedia",
                extract=extract,
            )
        )
        if len(references) >= needed:
            break
    return references


async def search_wikipedia(query: str, limit: int = 3) -> tuple[list[Reference], list[str]]:
    """Search Wikipedia for a topic and return references and text extracts.

    The first reference comes from the REST summary endpoint when it
    resolves; additional references come from the MediaWiki OpenSearch and
    extracts APIs. Never raises: any failure degrades to fewer sources.

    Returns:
        Tuple of (references, extracts) where extracts are the text content.
    """
    references: list[Reference] = []
    extracts: list[str] = []
    if not query.strip() or limit <= 0:
        return references, extracts

    async with _make_client() as client:
        primary = await _fetch_summary(client, query)
        if primary is not None:
            references.append(primary)
            extracts.append(primary.extract)

        related = await _fetch_related(
            client,
            query,
            needed=limit - len(references),
            exclude={r.title.casefold() for r in references} | {r.url for r in references},
        )
        for ref in related:
            references.append(ref)
            extracts.append(ref.extract)

    return references, extracts


def format_source_context(references: list[Reference], extracts: list[str]) -> str:
    """Format references and extracts into a source context string for prompts."""
    if not references:
        return "No source material available. Base the lesson on your general knowledge and clearly state this."

    parts = []
    for ref, extract in zip(references, extracts):
        parts.append(f"SOURCE: {ref.title}\nURL: {ref.url}\nCONTENT:\n{extract}\n")
    return "\n---\n".join(parts)
