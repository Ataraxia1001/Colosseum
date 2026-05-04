import os

from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker, create_async_engine

from ..config_loader import get_config
from .models import Base

_engine: AsyncEngine | None = None
_session_factory: async_sessionmaker[AsyncSession] | None = None


def _get_database_url() -> str | None:
    # Env var takes priority (e.g. Docker injection), then fall back to config.yaml.
    url = os.getenv("DATABASE_URL") or get_config().database.url
    if not url:
        return None
    # Normalise plain postgres:// or postgresql:// to asyncpg driver URL.
    if url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql+asyncpg://", 1)
    elif url.startswith("postgresql://") and "+asyncpg" not in url:
        url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
    return url


def get_engine() -> AsyncEngine | None:
    global _engine
    if _engine is not None:
        return _engine
    url = _get_database_url()
    if url is None:
        return None
    _engine = create_async_engine(url, echo=False, pool_pre_ping=True)
    return _engine


def get_session_factory() -> async_sessionmaker[AsyncSession] | None:
    global _session_factory
    if _session_factory is not None:
        return _session_factory
    engine = get_engine()
    if engine is None:
        return None
    _session_factory = async_sessionmaker(engine, expire_on_commit=False)
    return _session_factory


async def create_tables() -> None:
    """Create all tables if they don't exist. No-op when DATABASE_URL is not set."""
    engine = get_engine()
    if engine is None:
        return
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
