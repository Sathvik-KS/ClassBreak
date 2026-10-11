"""Tests for health and general API behavior."""

import pytest
from httpx import AsyncClient


@pytest.mark.anyio
async def test_health_check(client: AsyncClient):
    """Health endpoint returns ok status."""
    resp = await client.get("/api/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ok"
    assert "ai_provider" in data
    assert "version" in data


@pytest.mark.anyio
async def test_nonexistent_route(client: AsyncClient):
    """Unknown routes return 404."""
    resp = await client.get("/api/nonexistent")
    assert resp.status_code == 404
