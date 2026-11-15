import uuid
from datetime import UTC, datetime, timedelta
from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from datacurrent.api.dependencies import workspace_membership
from datacurrent.core.database import get_db
from datacurrent.models.entities import (
    DatabaseConnection,
    QueryFingerprint,
    QueryMetricSnapshot,
    WorkspaceMembership,
)
from datacurrent.schemas.queries import OverviewMetric, OverviewResponse, QuerySummary


router = APIRouter(prefix="/workspaces/{workspace_id}/overview", tags=["overview"])


@router.get("", response_model=OverviewResponse)
async def overview(
    workspace_id: uuid.UUID,
    hours: int = Query(default=24, ge=1, le=720),
    connection_id: uuid.UUID | None = None,
    _membership: WorkspaceMembership = Depends(workspace_membership),
    db: AsyncSession = Depends(get_db),
) -> OverviewResponse:
    since = datetime.now(UTC) - timedelta(hours=hours)
    filters = [
        QueryMetricSnapshot.workspace_id == workspace_id,
        QueryMetricSnapshot.captured_at >= since,
        DatabaseConnection.workspace_id == workspace_id,
    ]
    if connection_id:
        filters.append(DatabaseConnection.id == connection_id)
    latest = (
        select(
            QueryMetricSnapshot,
            func.row_number().over(
                partition_by=QueryMetricSnapshot.query_id,
                order_by=QueryMetricSnapshot.captured_at.desc(),
            ).label("rank"),
        )
        .join(QueryFingerprint, QueryFingerprint.id == QueryMetricSnapshot.query_id)
        .join(DatabaseConnection, DatabaseConnection.id == QueryFingerprint.connection_id)
        .where(*filters)
        .subquery()
    )
    aggregate = (
        await db.execute(
            select(
                func.sum(latest.c.calls),
                func.avg(latest.c.mean_time_ms),
                func.sum(latest.c.total_time_ms),
                func.count(latest.c.query_id),
                func.max(latest.c.captured_at),
            ).where(latest.c.rank == 1)
        )
    ).one()
    slow_rows = (
        await db.execute(
            select(QueryFingerprint, DatabaseConnection, latest)
            .join(DatabaseConnection, DatabaseConnection.id == QueryFingerprint.connection_id)
            .join(latest, latest.c.query_id == QueryFingerprint.id)
            .where(DatabaseConnection.workspace_id == workspace_id, latest.c.rank == 1)
            .order_by(latest.c.total_time_ms.desc())
            .limit(5)
        )
    ).all()
    slowest = [
        QuerySummary(
            id=row.QueryFingerprint.id,
            connection_id=row.DatabaseConnection.id,
            provider=row.DatabaseConnection.provider.value,
            fingerprint_hash=row.QueryFingerprint.fingerprint_hash,
            normalized_sql=row.QueryFingerprint.normalized_sql,
            operation=row.QueryFingerprint.operation,
            calls=row.calls,
            mean_time_ms=row.mean_time_ms,
            total_time_ms=row.total_time_ms,
            rows_processed=row.rows_processed,
            captured_at=row.captured_at,
            sample_kind="cumulative" if row.is_cumulative else "observation",
        )
        for row in slow_rows
    ]
    count, mean_latency, total_time, active_queries, freshness = aggregate
    available = freshness is not None
    limitations = [] if available else ["Historical telemetry has not been collected yet."]
    return OverviewResponse(
        time_range_hours=hours,
        execution_count=OverviewMetric(value=count, available=available, note="Cumulative for PostgreSQL; sampled observations for Snowflake."),
        mean_latency_ms=OverviewMetric(value=mean_latency, available=available),
        total_execution_time_ms=OverviewMetric(value=total_time, available=available),
        active_queries=OverviewMetric(value=active_queries, available=available),
        slowest_queries=slowest,
        data_freshness=freshness,
        limitations=limitations,
    )
