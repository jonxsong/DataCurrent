from collections.abc import AsyncIterator

from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker, create_async_engine

from datacurrent.core.config import get_settings


def normalize_async_url(url: str) -> str:
    return url.replace("postgresql+psycopg://", "postgresql+psycopg://", 1)


settings = get_settings()
engine: AsyncEngine = create_async_engine(
    normalize_async_url(settings.database_url),
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20,
    pool_recycle=1800,
)
SessionFactory = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)


async def get_db() -> AsyncIterator[AsyncSession]:
    async with SessionFactory() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
