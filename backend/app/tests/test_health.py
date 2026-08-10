"""Health check endpoint tests."""

from __future__ import annotations

import pytest
from httpx import AsyncClient


@pytest.mark.unit
@pytest.mark.anyio
async def test_health_check(client: AsyncClient):
    """Test that /health returns OK."""
    response = await client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["ok"] is True
    assert data["service"] == "xinhuo-api"
    assert data["storage"] == "mysql"


@pytest.mark.unit
@pytest.mark.anyio
async def test_api_health_check(client: AsyncClient):
    """Test that /api/health also works."""
    response = await client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["ok"] is True


@pytest.mark.unit
@pytest.mark.anyio
async def test_docs_available(client: AsyncClient):
    """Test that Swagger docs are accessible."""
    response = await client.get("/docs")
    assert response.status_code == 200


@pytest.mark.unit
@pytest.mark.anyio
async def test_openapi_schema(client: AsyncClient):
    """Test that OpenAPI schema is generated."""
    response = await client.get("/openapi.json")
    assert response.status_code == 200
    schema = response.json()
    assert "paths" in schema
    # Verify core endpoints are registered
    paths = schema["paths"]
    assert "/api/v1/auth/me" in paths
    assert "/api/v1/reference/majors" in paths
    assert "/api/v1/organization/colleges" in paths
    assert "/health" in paths
