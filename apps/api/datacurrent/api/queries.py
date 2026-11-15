import uuid
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from typing import Literal

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from datacurrent.api.dependencies import workspace_membership
from datacurrent.core.database import get_db
from datacurrent.core.errors import DataCurrentError
from datacurrent.models.entities import (
    DatabaseConnection,
    QueryFingerprint,
    QueryMetricSnapshot,
    WorkspaceMembership,
)
from datacurrent.schemas.queries import QueryDetail, QueryPage, QuerySummary, QueryTrendPoint


router = APIRouter(prefix="/workspaces/{workspace_id}/queries", tags=["queries"])


@router.get("", response_model=QueryPage)
async def list_queries(
    workspace_id: uuid.UUID,
    connection_id: uuid.UUID | None = None,
    search: str | None = Query(default=None, max_length=200),
    sort: Literal["total_time", "mean_time", "calls", "last_seen"] = "total_time",
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=100),
    _membership: WorkspaceMembership = Depends(workspace_membership),
    db: AsyncSession = Depends(get_db),
) -> QueryPage:
    latest = (
        select(
            QueryMetricSnapshot,
            func.row_number()
            .over(
                partition_by=QueryMetricSnapshot.query_id,
                order_by=QueryMetricSnapshot.captured_at.desc(),
            )
            .label("rank"),
        )
        .where(QueryMetricSnapshot.workspace_id == workspace_id)
        .subquery()
    )
    base = (
        select(QueryFingerprint, DatabaseConnection, latest)
        .join(DatabaseConnection, DatabaseConnection.id == QueryFingerprint.connection_id)
        .join(latest, latest.c.query_id == QueryFingerprint.id)
        .where(DatabaseConnection.workspace_id == workspace_id, latest.c.rank == 1)
    )
    if connection_id:
        base = base.where(DatabaseConnection.id == connection_id)
    if search:
        base = base.where(QueryFingerprint.normalized_sql.ilike(f"%{search}%"))
    count = await db.scalar(select(func.count()).select_from(base.order_by(None).subquery())) or 0
    order_map = {
        "total_time": latest.c.total_time_ms.desc(),
        "mean_time": latest.c.mean_time_ms.desc(),
        "calls": latest.c.calls.desc(),
        "last_seen": QueryFingerprint.last_seen_at.desc(),
    }
    rows = (
        await db.execute(base.order_by(order_map[sort]).offset((page - 1) * page_size).limit(page_size))
    ).all()
    items = [
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
        for row in rows
    ]
    return QueryPage(items=items, page=page, page_size=page_size, total=count)


async def query_trend(
    db: AsyncSession, workspace_id: uuid.UUID, query_id: uuid.UUID, hours: int
) -> list[QueryTrendPoint]:
    since = datetime.now(UTC) - timedelta(hours=hours)
    statement = text(
        """
        WITH ordered AS (
          SELECT captured_at, mean_time_ms, calls, total_time_ms, source_reset_at, is_cumulative,
                 lag(calls) OVER (ORDER BY captured_at) AS previous_calls,
                 lag(total_time_ms) OVER (ORDER BY captured_at) AS previous_total_time,
                 lag(source_reset_at) OVER (ORDER BY captured_at) AS previous_reset
            FROM query_metric_snapshots
           WHERE workspace_id = :workspace_id AND query_id = :query_id AND captured_at >= :since
        )
        SELECT captured_at, mean_time_ms,
               CASE WHEN is_cumulative AND (previous_reset IS NULL OR source_reset_at = previous_reset)
                    THEN GREATEST(calls - previous_calls, 0) END AS calls_delta,
               CASE WHEN is_cumulative AND (previous_reset IS NULL OR source_reset_at = previous_reset)
                    THEN GREATEST(total_time_ms - previous_total_time, 0) END AS total_time_delta_ms,
               (is_cumulative AND previous_reset IS NOT NULL AND source_reset_at IS DISTINCT FROM previous_reset) AS counter_reset
          FROM ordered ORDER BY captured_at
        """
    )
    rows = (await db.execute(statement, {"workspace_id": workspace_id, "query_id": query_id, "since": since})).mappings()
    return [QueryTrendPoint.model_validate(dict(row)) for row in rows]


@router.get("/{query_id}", response_model=QueryDetail)
async def get_query(
    workspace_id: uuid.UUID,
    query_id: uuid.UUID,
    hours: int = Query(default=24, ge=1, le=720),
    _membership: WorkspaceMembership = Depends(workspace_membership),
    db: AsyncSession = Depends(get_db),
) -> QueryDetail:
    row = (
        await db.execute(
            select(QueryFingerprint, DatabaseConnection, QueryMetricSnapshot)
            .join(DatabaseConnection, DatabaseConnection.id == QueryFingerprint.connection_id)
            .join(QueryMetricSnapshot, QueryMetricSnapshot.query_id == QueryFingerprint.id)
            .where(
                QueryFingerprint.id == query_id,
                DatabaseConnection.workspace_id == workspace_id,
                QueryMetricSnapshot.workspace_id == workspace_id,
            )
            .order_by(QueryMetricSnapshot.captured_at.desc())
            .limit(1)
        )
    ).first()
    if not row:
        raise DataCurrentError("Query not found", code="query_not_found", status_code=404)
    query, connection, metric = row
    trend = await query_trend(db, workspace_id, query_id, hours)
    return QueryDetail(
        id=query.id,
        connection_id=connection.id,
        provider=connection.provider.value,
        fingerprint_hash=query.fingerprint_hash,
        normalized_sql=query.normalized_sql,
        operation=query.operation,
        calls=metric.calls,
        mean_time_ms=metric.mean_time_ms,
        total_time_ms=metric.total_time_ms,
        rows_processed=metric.rows_processed,
        captured_at=metric.captured_at,
        sample_kind="cumulative" if metric.is_cumulative else "observation",
        referenced_objects=query.referenced_objects,
        first_seen_at=query.first_seen_at,
        last_seen_at=query.last_seen_at,
        trend=trend,
    )
