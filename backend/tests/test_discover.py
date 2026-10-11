"""Tests for the discovery feed endpoint."""

import pytest
from httpx import AsyncClient


@pytest.mark.anyio
async def test_feed_default(client: AsyncClient):
    """Feed returns items with default parameters."""
    resp = await client.post("/api/discover/feed", json={
        "interests": ["psychology", "science"],
        "count": 5,
    })
    assert resp.status_code == 200
    data = resp.json()
    assert "items" in data
    assert len(data["items"]) > 0
    item = data["items"][0]
    assert "title" in item
    assert "hook" in item
    assert "topic" in item
    assert "domain" in item


@pytest.mark.anyio
async def test_feed_empty_interests(client: AsyncClient):
    """Feed works with no interests specified."""
    resp = await client.post("/api/discover/feed", json={"count": 3})
    assert resp.status_code == 200
    assert len(resp.json()["items"]) > 0


@pytest.mark.anyio
async def test_feed_with_exclusions(client: AsyncClient):
    """Feed respects excluded topics."""
    resp = await client.post("/api/discover/feed", json={
        "interests": ["psychology"],
        "excluded_topics": ["selective attention"],
        "count": 10,
    })
    assert resp.status_code == 200


@pytest.mark.anyio
async def test_feed_count_limit(client: AsyncClient):
    """Feed respects count limit."""
    resp = await client.post("/api/discover/feed", json={"count": 2})
    assert resp.status_code == 200
    assert len(resp.json()["items"]) <= 2


@pytest.mark.anyio
async def test_feed_invalid_count(client: AsyncClient):
    """Feed rejects invalid count values."""
    resp = await client.post("/api/discover/feed", json={"count": 0})
    assert resp.status_code == 422

    resp = await client.post("/api/discover/feed", json={"count": 100})
    assert resp.status_code == 422
