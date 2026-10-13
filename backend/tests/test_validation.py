"""Tests for request validation and consistent error responses."""

import json

import pytest
from httpx import AsyncClient


@pytest.mark.anyio
async def test_oversized_body_rejected_with_413(client: AsyncClient):
    """Bodies beyond the size guard never reach endpoint validation."""
    big = {"lesson_content": "x" * 200_000, "topic": "t"}
    resp = await client.post(
        "/api/lessons/quiz",
        content=json.dumps(big),
        headers={"content-type": "application/json"},
    )
    assert resp.status_code == 413
    assert resp.json() == {"detail": "Request body too large"}


@pytest.mark.anyio
async def test_normal_body_within_size_limit_passes(client: AsyncClient):
    """The size guard does not block ordinary requests."""
    resp = await client.post(
        "/api/lessons/quiz",
        json={"lesson_content": "A short lesson.", "topic": "selective attention"},
    )
    assert resp.status_code == 200


@pytest.mark.anyio
async def test_sources_query_too_long_rejected(client: AsyncClient):
    resp = await client.get("/api/sources/search", params={"q": "x" * 201})
    assert resp.status_code == 422


@pytest.mark.anyio
async def test_sources_query_missing_rejected(client: AsyncClient):
    resp = await client.get("/api/sources/search")
    assert resp.status_code == 422


@pytest.mark.anyio
async def test_sources_query_empty_rejected(client: AsyncClient):
    resp = await client.get("/api/sources/search", params={"q": ""})
    assert resp.status_code == 422


@pytest.mark.anyio
async def test_missing_required_field_rejected(client: AsyncClient):
    resp = await client.post("/api/lessons/generate", json={"duration_minutes": 5})
    assert resp.status_code == 422


@pytest.mark.anyio
async def test_invalid_depth_value_rejected(client: AsyncClient):
    resp = await client.post(
        "/api/lessons/generate",
        json={"topic": "selective attention", "depth": "expert"},
    )
    assert resp.status_code == 422
