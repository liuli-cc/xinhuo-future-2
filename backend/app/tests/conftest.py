"""Pytest fixtures for backend tests."""

from __future__ import annotations

import pytest
from httpx import AsyncClient, ASGITransport

from ..main import app


@pytest.fixture
def anyio_backend():
    return "asyncio"


@pytest.fixture
async def client():
    """Async HTTP test client for the FastAPI app."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
