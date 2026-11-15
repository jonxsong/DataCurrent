import asyncio
import hashlib
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from typing import Any

import psycopg
import snowflake.connector
from psycopg.rows import dict_row
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from datacurrent.analysis.sql import parse_query
from datacurrent.connectors.postgresql import PostgreSQLConnector
from datacurrent.connectors.snowflake import SnowflakeConnector
from datacurrent.core.crypto import decrypt_config
from datacurrent.models.entities import (
    DatabaseConnection,
    DatabaseProvider,
    QueryFingerprint,
    QueryMetricSnapshot,
)


@dataclass(frozen=True)
class QueryMetric:
    provider_query_id: str | None
    sql: str
    calls: int
    total_time_ms: Decimal
    mean_time_ms: Decimal
    rows_processed: int
    shared_blocks_read: int | None
    captured_at: datetime
    source_reset_at: datetime | None
    is_cumulative: bool


async def collect_postgres(config: dict[str, Any]) -> list[QueryMetric]:
    connector = PostgreSQLConnector(config)
    query = """
        SELECT s.queryid::text AS query_id, s.query, s.calls,
               s.total_exec_time AS total_time_ms, s.mean_exec_time AS mean_time_ms,
               s.rows AS rows_processed, s.shared_blks_read,
               COALESCE(i.stats_reset, pg_postmaster_start_time()) AS source_reset_at
          FROM pg_stat_statements s
          LEFT JOIN pg_stat_statements_info i ON true
         WHERE s.query NOT ILIKE '%%pg_stat_statements%%'
           AND s.query NOT ILIKE '%%datacurrent%%'
         ORDER BY s.total_exec_time DESC
         LIMIT 1000
    """
    async with await psycopg.AsyncConnection.connect(**connector._kwargs(), row_factory=dict_row) as conn:
        rows = await (await conn.execute(query)).fetchall()
    captured_at = datetime.now(UTC)
    return [
        QueryMetric(
            provider_query_id=row["query_id"],
            sql=row["query"],
            calls=row["calls"],
            total_time_ms=Decimal(str(row["total_time_ms"])),
            mean_time_ms=Decimal(str(row["mean_time_ms"])),
            rows_processed=row["rows_processed"],
            shared_blocks_read=row["shared_blks_read"],
            captured_at=captured_at,
            source_reset_at=row["source_reset_at"],
            is_cumulative=True,
        )
        for row in rows
    ]


def _collect_snowflake_sync(config: dict[str, Any]) -> list[QueryMetric]:
    connector = SnowflakeConnector(config)
    start = datetime.now(UTC) - timedelta(hours=1)
    query = """
        SELECT QUERY_ID, QUERY_TEXT, TOTAL_ELAPSED_TIME, ROWS_PRODUCED,
               START_TIME, END_TIME
          FROM SNOWFLAKE.ACCOUNT_USAGE.QUERY_HISTORY
         WHERE START_TIME >= %s
           AND QUERY_TYPE NOT IN ('SHOW', 'DESCRIBE')
           AND QUERY_TAG IS DISTINCT FROM 'datacurrent'
         ORDER BY START_TIME DESC
         LIMIT 1000
    """
    with connector._connect() as conn:
        with conn.cursor() as cursor:
            cursor.execute(query, (start,))
            rows = cursor.fetchall()
    return [
        QueryMetric(
            provider_query_id=query_id,
            sql=query_text,
            calls=1,
            total_time_ms=Decimal(str(elapsed_ms)),
            mean_time_ms=Decimal(str(elapsed_ms)),
            rows_processed=int(rows_produced or 0),
            shared_blocks_read=None,
            captured_at=end_time,
            source_reset_at=None,
            is_cumulative=False,
        )
        for query_id, query_text, elapsed_ms, rows_produced, _start_time, end_time in rows
    ]


async def collect_snowflake(config: dict[str, Any]) -> list[QueryMetric]:
    return await asyncio.to_thread(_collect_snowflake_sync, config)


async def persist_metrics(
    db: AsyncSession,
    connection: DatabaseConnection,
    metrics: list[QueryMetric],
    *,
    interval_seconds: int,
) -> int:
    dialect = "postgres" if connection.provider is DatabaseProvider.POSTGRESQL else "snowflake"
    inserted = 0
    for metric in metrics:
        try:
            parsed = parse_query(metric.sql, dialect=dialect)
            fingerprint_hash = parsed.fingerprint
            normalized_sql = parsed.redacted_sql
            operation = parsed.operation
            referenced_objects = list(parsed.referenced_tables)
        except Exception:
            fingerprint_hash = hashlib.sha256(metric.sql.encode()).hexdigest()
            normalized_sql = metric.sql[:100_000]
            operation = None
            referenced_objects = []
        statement = (
            insert(QueryFingerprint)
            .values(
                connection_id=connection.id,
                provider_query_id=metric.provider_query_id,
                fingerprint_hash=fingerprint_hash,
                normalized_sql=normalized_sql,
                operation=operation,
                referenced_objects=referenced_objects,
                first_seen_at=metric.captured_at,
                last_seen_at=metric.captured_at,
            )
            .on_conflict_do_update(
                constraint="uq_query_fingerprints_connection_id",
                set_={
                    "provider_query_id": metric.provider_query_id,
                    "last_seen_at": metric.captured_at,
                    "referenced_objects": referenced_objects,
                },
            )
            .returning(QueryFingerprint.id)
        )
        query_id = await db.scalar(statement)
        db.add(
            QueryMetricSnapshot(
                workspace_id=connection.workspace_id,
                query_id=query_id,
                captured_at=metric.captured_at,
                interval_seconds=interval_seconds,
                calls=metric.calls,
                total_time_ms=metric.total_time_ms,
                mean_time_ms=metric.mean_time_ms,
                rows_processed=metric.rows_processed,
                shared_blocks_read=metric.shared_blocks_read,
                source_reset_at=metric.source_reset_at,
                is_cumulative=metric.is_cumulative,
            )
        )
        inserted += 1
    connection.last_collected_at = datetime.now(UTC)
    await db.commit()
    return inserted


async def collect_connection_metrics(
    db: AsyncSession, connection_id: Any, *, interval_seconds: int = 60
) -> int:
    connection = await db.scalar(select(DatabaseConnection).where(DatabaseConnection.id == connection_id))
    if connection is None:
        return 0
    config = decrypt_config(connection.encrypted_config)
    if connection.provider is DatabaseProvider.POSTGRESQL:
        metrics = await collect_postgres(config)
    else:
        metrics = await collect_snowflake(config)
    return await persist_metrics(db, connection, metrics, interval_seconds=interval_seconds)
