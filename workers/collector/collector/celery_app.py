import asyncio
import uuid
from contextlib import asynccontextmanager
from datetime import UTC, datetime, timedelta
from typing import AsyncIterator

import structlog
from celery import Celery
from redis.asyncio import Redis
from sqlalchemy import delete, select

from datacurrent.collection import collect_connection_metrics
from datacurrent.core.config import get_settings
from datacurrent.core.database import SessionFactory
from datacurrent.models.entities import (
    ConnectionStatus,
    DatabaseConnection,
    QueryMetricSnapshot,
    Workspace,
)


settings = get_settings()
logger = structlog.get_logger(__name__)

app = Celery("datacurrent", broker=settings.redis_url, backend=settings.redis_url)
app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    task_acks_late=True,
    task_reject_on_worker_lost=True,
    worker_prefetch_multiplier=1,
    broker_connection_retry_on_startup=True,
    beat_schedule={
        "collect-enabled-connections": {
            "task": "collector.schedule_all",
            "schedule": 60.0,
        },
        "enforce-metric-retention": {
            "task": "collector.enforce_retention",
            "schedule": 3600.0,
        },
    },
)


@asynccontextmanager
async def connection_lock(connection_id: str, ttl_seconds: int = 55) -> AsyncIterator[bool]:
    redis = Redis.from_url(settings.redis_url)
    key = f"datacurrent:collector-lock:{connection_id}"
    token = uuid.uuid4().hex
    acquired = bool(await redis.set(key, token, ex=ttl_seconds, nx=True))
    try:
        yield acquired
    finally:
        if acquired:
            script = "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end"
            await redis.eval(script, 1, key, token)
        await redis.aclose()


async def _collect(connection_id: str) -> int:
    async with connection_lock(connection_id) as acquired:
        if not acquired:
            await logger.ainfo("collection.skipped_overlap", connection_id=connection_id)
            return 0
        async with SessionFactory() as db:
            return await collect_connection_metrics(db, uuid.UUID(connection_id))


@app.task(
    name="collector.collect_connection",
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_backoff_max=300,
    retry_jitter=True,
    max_retries=5,
)
def collect_connection(connection_id: str) -> int:
    return asyncio.run(_collect(connection_id))


async def _schedule_all() -> int:
    async with SessionFactory() as db:
        ids = list(
            (
                await db.scalars(
                    select(DatabaseConnection.id).where(
                        DatabaseConnection.collect_enabled.is_(True),
                        DatabaseConnection.status != ConnectionStatus.DISABLED,
                    )
                )
            ).all()
        )
    for connection_id in ids:
        collect_connection.delay(str(connection_id))
    return len(ids)


@app.task(name="collector.schedule_all")
def schedule_all() -> int:
    return asyncio.run(_schedule_all())


async def _enforce_retention() -> int:
    deleted = 0
    async with SessionFactory() as db:
        workspaces = list((await db.scalars(select(Workspace))).all())
        for workspace in workspaces:
            cutoff = datetime.now(UTC) - timedelta(days=workspace.retention_days)
            result = await db.execute(
                delete(QueryMetricSnapshot).where(
                    QueryMetricSnapshot.workspace_id == workspace.id,
                    QueryMetricSnapshot.captured_at < cutoff,
                )
            )
            deleted += result.rowcount or 0
        await db.commit()
    return deleted


@app.task(name="collector.enforce_retention")
def enforce_retention() -> int:
    return asyncio.run(_enforce_retention())
