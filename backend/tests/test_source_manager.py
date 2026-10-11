"""Tests for the Wikipedia source manager.

All HTTP goes through httpx.MockTransport with recorded fixtures captured
on 2026-10-11 (see tests/fixtures/) — no test depends on live Wikipedia.
"""

import httpx
import pytest

from app.models.common import Reference
from app.services import source_manager
from app.services.source_manager import format_source_context, search_wikipedia
from tests.conftest import load_wikipedia_fixture, offline_wikipedia_handler


class RecordingHandler:
    """Wrap a handler and record every request it receives."""

    def __init__(self, inner):
        self.inner = inner
        self.requests: list[httpx.Request] = []

    def __call__(self, request: httpx.Request) -> httpx.Response:
        self.requests.append(request)
        return self.inner(request)

    @property
    def paths(self) -> list[str]:
        return [str(r.url) for r in self.requests]


def install(monkeypatch, handler) -> None:
    """Route source_manager through the given MockTransport handler."""
    def factory() -> httpx.AsyncClient:
        return httpx.AsyncClient(transport=httpx.MockTransport(handler))

    monkeypatch.setattr(source_manager, "_make_client", factory)


def status_only(status_code: int, json_body=None):
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(status_code, json=json_body)
    return handler


@pytest.mark.anyio
async def test_returns_up_to_limit_sources_offline(monkeypatch):
    """Summary + opensearch + extracts yield aligned references/extracts."""
    recorder = RecordingHandler(offline_wikipedia_handler)
    install(monkeypatch, recorder)

    references, extracts = await search_wikipedia("selective attention", limit=3)

    assert len(references) == 3
    assert len(extracts) == 3
    assert [r.title for r in references] == [
        "Attentional control",
        "The Invisible Gorilla",
        "Selective retention",
    ]
    # Redirect target wins over the search title; no duplicates.
    assert len({r.title for r in references}) == 3
    for ref, extract in zip(references, extracts):
        assert ref.source_type == "wikipedia"
        assert ref.url.startswith("https://en.wikipedia.org/wiki/")
        assert extract
        assert ref.extract == extract


@pytest.mark.anyio
async def test_decommissioned_related_endpoint_is_never_called(monkeypatch):
    """The broken REST /page/related/ endpoint must not be requested."""
    recorder = RecordingHandler(offline_wikipedia_handler)
    install(monkeypatch, recorder)

    await search_wikipedia("selective attention", limit=3)

    assert recorder.paths, "expected Wikipedia requests to be recorded"
    assert not any("/page/related/" in p for p in recorder.paths)
    assert any("/page/summary/" in p for p in recorder.paths)
    assert any("action=opensearch" in p for p in recorder.paths)
    assert any("action=query" in p for p in recorder.paths)


@pytest.mark.anyio
async def test_missing_article_falls_back_to_search(monkeypatch):
    """A summary 404 still yields sources from opensearch + extracts."""
    def handler(request: httpx.Request) -> httpx.Response:
        if "/page/summary/" in request.url.path:
            return httpx.Response(404, json=load_wikipedia_fixture("summary_not_found.json"))
        return offline_wikipedia_handler(request)

    install(monkeypatch, handler)

    references, extracts = await search_wikipedia("selective attention", limit=3)

    assert len(references) == 3
    assert len(extracts) == 3
    assert all(r.extract for r in references)


@pytest.mark.anyio
async def test_opensearch_http_error_keeps_summary(monkeypatch):
    """A failing search API degrades to the primary summary source only."""
    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.params.get("action") == "opensearch":
            return httpx.Response(500, json={"error": "boom"})
        return offline_wikipedia_handler(request)

    install(monkeypatch, handler)

    references, extracts = await search_wikipedia("selective attention", limit=3)

    assert len(references) == 1
    assert references[0].title == "Attentional control"
    assert extracts == [references[0].extract]


@pytest.mark.anyio
async def test_extracts_http_error_keeps_summary(monkeypatch):
    """A failing extracts API degrades to the primary summary source only."""
    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.params.get("action") == "query":
            return httpx.Response(503)
        return offline_wikipedia_handler(request)

    install(monkeypatch, handler)

    references, extracts = await search_wikipedia("selective attention", limit=3)

    assert len(references) == 1
    assert references[0].title == "Attentional control"
    assert len(extracts) == 1


@pytest.mark.anyio
async def test_summary_http_error_falls_back_to_search(monkeypatch):
    """A failing summary endpoint still yields search-based sources."""
    def handler(request: httpx.Request) -> httpx.Response:
        if "/page/summary/" in request.url.path:
            return httpx.Response(500)
        return offline_wikipedia_handler(request)

    install(monkeypatch, handler)

    references, extracts = await search_wikipedia("selective attention", limit=3)

    assert len(references) == 3
    assert len(extracts) == 3


@pytest.mark.anyio
async def test_timeout_returns_empty_without_raising(monkeypatch):
    """Total network failure returns empty results instead of raising."""
    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectTimeout("simulated timeout", request=request)

    install(monkeypatch, handler)

    references, extracts = await search_wikipedia("selective attention", limit=3)

    assert references == []
    assert extracts == []


@pytest.mark.anyio
async def test_summary_timeout_still_fetches_related(monkeypatch):
    """A summary timeout alone still produces search-based sources."""
    def handler(request: httpx.Request) -> httpx.Response:
        if "/page/summary/" in request.url.path:
            raise httpx.ReadTimeout("simulated timeout", request=request)
        return offline_wikipedia_handler(request)

    install(monkeypatch, handler)

    references, extracts = await search_wikipedia("selective attention", limit=3)

    assert len(references) == 3
    assert len(extracts) == 3


@pytest.mark.anyio
async def test_malformed_json_is_treated_as_missing(monkeypatch):
    """Invalid JSON bodies degrade gracefully instead of raising."""
    def handler(request: httpx.Request) -> httpx.Response:
        if "/page/summary/" in request.url.path:
            return httpx.Response(200, text="<html>not json</html>")
        if request.url.params.get("action") == "opensearch":
            return httpx.Response(200, text="{broken")
        return offline_wikipedia_handler(request)

    install(monkeypatch, handler)

    references, extracts = await search_wikipedia("selective attention", limit=3)

    # Summary unusable, opensearch unusable -> nothing to build related from.
    assert references == []
    assert extracts == []


@pytest.mark.anyio
async def test_missing_and_empty_extract_pages_are_skipped(monkeypatch):
    """Pages flagged missing or with an empty extract produce no source."""
    extracts_payload = {
        "batchcomplete": True,
        "query": {
            "pages": [
                {"title": "Ghost article", "missing": True},
                {"title": "Empty article", "extract": ""},
                {"title": "Real article", "extract": "A usable extract."},
            ],
        },
    }
    opensearch_payload = ["q", ["Ghost article", "Empty article", "Real article"], ["", "", ""], ["a", "b", "c"]]

    def handler(request: httpx.Request) -> httpx.Response:
        if "/page/summary/" in request.url.path:
            return httpx.Response(404, json={"status": 404, "type": "not found"})
        action = request.url.params.get("action")
        if action == "opensearch":
            return httpx.Response(200, json=opensearch_payload)
        if action == "query":
            return httpx.Response(200, json=extracts_payload)
        return httpx.Response(404)

    install(monkeypatch, handler)

    references, extracts = await search_wikipedia("anything", limit=3)

    assert [r.title for r in references] == ["Real article"]
    assert extracts == ["A usable extract."]


@pytest.mark.anyio
async def test_limit_one_skips_search_entirely(monkeypatch):
    """With limit=1 only the summary is fetched; no search calls."""
    recorder = RecordingHandler(offline_wikipedia_handler)
    install(monkeypatch, recorder)

    references, extracts = await search_wikipedia("selective attention", limit=1)

    assert len(references) == 1
    assert len(extracts) == 1
    assert not any("action=opensearch" in p for p in recorder.paths)


@pytest.mark.anyio
async def test_empty_query_returns_empty_without_requests(monkeypatch):
    """Empty/blank queries short-circuit with no network traffic."""
    recorder = RecordingHandler(offline_wikipedia_handler)
    install(monkeypatch, recorder)

    assert await search_wikipedia("") == ([], [])
    assert await search_wikipedia("   ") == ([], [])
    assert recorder.requests == []


def test_format_source_context_fallback():
    """No references produces the documented fallback guidance."""
    context = format_source_context([], [])
    assert context.startswith("No source material available.")


def test_format_source_context_formats_sources():
    """Sources render as SOURCE/URL/CONTENT blocks for prompts."""
    ref = Reference(
        title="Attentional control",
        url="https://en.wikipedia.org/wiki/Attentional_control",
        extract="...",
    )
    context = format_source_context([ref], ["An extract."])
    assert "SOURCE: Attentional control" in context
    assert "URL: https://en.wikipedia.org/wiki/Attentional_control" in context
    assert "CONTENT:\nAn extract." in context
