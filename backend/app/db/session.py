"""
SQLAlchemy engine and session factory.

Session management follows the "session per request" pattern —
a new session is created for each HTTP request and closed when
the request completes.
"""

from __future__ import annotations

from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from ..core.config import get_settings

# Convert sync MySQL URL to async (pymysql → aiomysql)
def _make_async_url(sync_url: str) -> str:
    return sync_url.replace("mysql+pymysql://", "mysql+aiomysql://")

_engine = None
_session_factory = None


def get_engine():
    global _engine
    if _engine is None:
        settings = get_settings()
        async_url = _make_async_url(settings.database_url)
        options = {"echo": settings.DEBUG, "pool_pre_ping": True}
        if not async_url.startswith("sqlite"):
            options.update(pool_size=10, max_overflow=20, pool_recycle=3600)
        _engine = create_async_engine(async_url, **options)
    return _engine


def get_session_factory() -> async_sessionmaker[AsyncSession]:
    global _session_factory
    if _session_factory is None:
        _session_factory = async_sessionmaker(
            get_engine(),
            class_=AsyncSession,
            expire_on_commit=False,
        )
    return _session_factory


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency: yields a database session per request."""
    factory = get_session_factory()
    async with factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def reset_database_state() -> None:
    """Dispose cached engine/session state (used by tests and maintenance tools)."""
    global _engine, _session_factory
    if _engine is not None:
        await _engine.dispose()
    _engine = None
    _session_factory = None
