from datetime import UTC, datetime

from fastapi import APIRouter, Depends
from redis.asyncio import Redis
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from datacurrent.core.config import Settings, get_settings
from datacurrent.core.database import get_db


router = APIRouter(tags=["health"])


@router.get("/healthz")
async def health() -> dict[str, str]:
    return {"status": "ok", "timestamp": datetime.now(UTC).isoformat()}


@router.get("/readyz")
async def readiness(
    db: AsyncSession = Depends(get_db), settings: Settings = Depends(get_settings)
) -> dict[str, object]:
    await db.execute(text("SELECT 1"))
    redis = Redis.from_url(settings.redis_url, socket_timeout=2)
    try:
        redis_ok = bool(await redis.ping())
    finally:
        await redis.aclose()
    return {"status": "ready", "checks": {"postgres": True, "redis": redis_ok}}
