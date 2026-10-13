"""Tests for structural citation validation of AI-provided references.

These tests assert ONLY structural properties (does the citation refer to a
source we actually retrieved? is the URL well-formed?). They do not — and do
not claim to — verify that a source semantically supports any claim.
"""

from types import SimpleNamespace

import pytest
from httpx import AsyncClient

from app.models.common import Reference
from app.routers.lessons import validate_references


def _ref(url: str, title: str = "T") -> Reference:
    return Reference(title=title, url=url, source_type="wikipedia", extract="")


# --- unit: validate_references -------------------------------------------------


def test_matching_fetched_url_marked_wikipedia():
    fetched = [_ref("https://en.wikipedia.org/wiki/Selective_attention")]
    result = validate_references(
        [{"title": "Selective attention", "url": "https://en.wikipedia.org/wiki/Selective_attention"}],
        fetched,
    )
    assert len(result) == 1
    assert result[0].source_type == "wikipedia"


def test_url_normalization_tolerates_trailing_slash_case_and_query():
    fetched = [_ref("https://en.wikipedia.org/wiki/Selective_attention")]
    result = validate_references(
        [
            {
                "title": "Article",
                "url": "https://EN.wikipedia.org/wiki/Selective_attention/?utm_source=x#frag",
            }
        ],
        fetched,
    )
    assert len(result) == 1
    assert result[0].source_type == "wikipedia"


def test_valid_url_not_in_fetched_marked_provided_not_wikipedia():
    """Honest labeling: structurally valid but NOT verified against sources."""
    result = validate_references(
        [{"title": "Elsewhere", "url": "https://example.com/article"}],
        [],
    )
    assert len(result) == 1
    assert result[0].source_type == "provided"


def test_malformed_urls_dropped():
    result = validate_references(
        [
            {"title": "Not a URL", "url": "not-a-url"},
            {"title": "No host", "url": "http://"},
            {"title": "Empty", "url": ""},
            {"title": "Missing url", "url": None},
        ],
        [],
    )
    assert result == []


def test_empty_title_dropped_even_with_valid_url():
    result = validate_references(
        [{"title": "   ", "url": "https://example.com/x"}],
        [],
    )
    assert result == []


def test_non_dict_entries_dropped():
    result = validate_references(["just a string", 42, None], [])
    assert result == []


def test_duplicate_urls_deduped():
    result = validate_references(
        [
            {"title": "A", "url": "https://example.com/x"},
            {"title": "A again", "url": "https://example.com/x/"},
        ],
        [],
    )
    assert len(result) == 1


def test_unfetched_sources_appended():
    fetched = [
        _ref("https://en.wikipedia.org/wiki/Attention"),
        _ref("https://en.wikipedia.org/wiki/Cocktail_party_effect"),
    ]
    result = validate_references(
        [{"title": "Attention", "url": "https://en.wikipedia.org/wiki/Attention"}],
        fetched,
    )
    assert [r.url for r in result] == [
        "https://en.wikipedia.org/wiki/Attention",
        "https://en.wikipedia.org/wiki/Cocktail_party_effect",
    ]


def test_none_ai_references_handled():
    assert validate_references(None, []) == []


# --- endpoint integration ------------------------------------------------------


class _FakeProvider:
    async def generate_lesson(self, **kwargs):
        return {
            "title": "T",
            "summary": "S",
            "sections": [{"heading": "H", "content": "C", "key_points": []}],
            "references": [
                {"title": "Fabricated", "url": "javascript:alert(1)"},
                {"title": "Unrelated site", "url": "https://totally-not-wikipedia.example/x"},
            ],
        }

    async def generate_quiz(self, **kwargs):
        return []

    async def evaluate_answer(self, **kwargs):
        return {}

    async def generate_feed(self, **kwargs):
        return []

    async def tutor_chat(self, **kwargs):
        return {}


@pytest.mark.anyio
async def test_lesson_endpoint_drops_malformed_refs_and_labels_unverified(
    client: AsyncClient, monkeypatch
):
    import app.routers.lessons as lessons_mod

    monkeypatch.setattr(lessons_mod, "get_ai_provider", lambda: _FakeProvider())
    resp = await client.post("/api/lessons/generate", json={"topic": "selective attention"})
    assert resp.status_code == 200
    refs = resp.json()["references"]

    urls = [r["url"] for r in refs]
    # Malformed (javascript:) URL never reaches the client.
    assert "javascript:alert(1)" not in urls
    # The unverified-but-valid URL is present and honestly labeled.
    unverified = [r for r in refs if r["url"] == "https://totally-not-wikipedia.example/x"]
    assert len(unverified) == 1
    assert unverified[0]["source_type"] == "provided"
    # Anything labeled "wikipedia" must come from sources we actually fetched
    # (fixtures for the topic) — never a model invention.
    fetched_urls = {r["url"] for r in refs if r["source_type"] == "wikipedia"}
    assert all("wikipedia.org" in u for u in fetched_urls)
