import asyncio
import hashlib
import json
import math
import statistics
import time
from collections import Counter
from dataclasses import dataclass
from decimal import Decimal
from typing import Any

import psycopg
from psycopg.rows import tuple_row

from datacurrent.analysis.sql import assert_read_only_select, parse_query
from datacurrent.connectors.postgresql import PostgreSQLConnector
from datacurrent.connectors.snowflake import SnowflakeConnector
from datacurrent.models.entities import DatabaseProvider


@dataclass(frozen=True)
class QueryMeasurement:
    latencies_ms: list[float]
    median_ms: float
    p95_ms: float
    result_digest: str
    row_count: int
    truncated: bool


@dataclass(frozen=True)
class BenchmarkComparison:
    original: QueryMeasurement
    candidate: QueryMeasurement
    speedup_ratio: float
    result_agreement: str
    caveats: list[str]


def percentile(values: list[float], quantile: float) -> float:
    ordered = sorted(values)
    index = max(0, min(len(ordered) - 1, math.ceil(len(ordered) * quantile) - 1))
    return ordered[index]


def _canonical_value(value: Any) -> Any:
    if isinstance(value, Decimal):
        return {"decimal": format(value, "f")}
    if isinstance(value, bytes):
        return {"bytes": value.hex()}
    if hasattr(value, "isoformat"):
        return {"temporal": value.isoformat()}
    return value


def digest_rows(rows: list[tuple[Any, ...]], *, ordered: bool) -> str:
    serialized = [json.dumps([_canonical_value(value) for value in row], sort_keys=True, default=str) for row in rows]
    if ordered:
        material = json.dumps(serialized, separators=(",", ":"))
    else:
        material = json.dumps(sorted(Counter(serialized).items()), separators=(",", ":"))
    return hashlib.sha256(material.encode()).hexdigest()


async def _measure_postgres(
    config: dict[str, Any], sql: str, warmups: int, iterations: int, ordered: bool
) -> QueryMeasurement:
    connector = PostgreSQLConnector(config)
    latencies: list[float] = []
    final_rows: list[tuple[Any, ...]] = []
    truncated = False
    async with await psycopg.AsyncConnection.connect(**connector._kwargs(), row_factory=tuple_row) as conn:
        await conn.set_read_only(True)
        for index in range(warmups + iterations):
            started = time.perf_counter()
            cursor = await conn.execute(sql)
            rows = await cursor.fetchmany(10_001)
            elapsed = (time.perf_counter() - started) * 1000
            if len(rows) > 10_000:
                rows = rows[:10_000]
                truncated = True
            if index >= warmups:
                latencies.append(elapsed)
                final_rows = rows
    return QueryMeasurement(
        latencies_ms=latencies,
        median_ms=statistics.median(latencies),
        p95_ms=percentile(latencies, 0.95),
        result_digest=digest_rows(final_rows, ordered=ordered),
        row_count=len(final_rows),
        truncated=truncated,
    )


def _measure_snowflake_sync(
    config: dict[str, Any], sql: str, warmups: int, iterations: int, ordered: bool
) -> QueryMeasurement:
    connector = SnowflakeConnector(config)
    latencies: list[float] = []
    final_rows: list[tuple[Any, ...]] = []
    truncated = False
    with connector._connect() as conn:
        with conn.cursor() as cursor:
            for index in range(warmups + iterations):
                started = time.perf_counter()
                cursor.execute(sql)
                rows = cursor.fetchmany(10_001)
                elapsed = (time.perf_counter() - started) * 1000
                if len(rows) > 10_000:
                    rows = rows[:10_000]
                    truncated = True
                if index >= warmups:
                    latencies.append(elapsed)
                    final_rows = rows
    return QueryMeasurement(
        latencies_ms=latencies,
        median_ms=statistics.median(latencies),
        p95_ms=percentile(latencies, 0.95),
        result_digest=digest_rows(final_rows, ordered=ordered),
        row_count=len(final_rows),
        truncated=truncated,
    )


async def compare_queries(
    provider: DatabaseProvider,
    config: dict[str, Any],
    original_sql: str,
    candidate_sql: str,
    *,
    warmups: int,
    iterations: int,
) -> BenchmarkComparison:
    dialect = "postgres" if provider is DatabaseProvider.POSTGRESQL else "snowflake"
    original = parse_query(original_sql, dialect=dialect)
    candidate = parse_query(candidate_sql, dialect=dialect)
    assert_read_only_select(original)
    assert_read_only_select(candidate)
    ordered = "ORDER BY" in original.normalized_sql.upper() or "ORDER BY" in candidate.normalized_sql.upper()
    measure = _measure_postgres if provider is DatabaseProvider.POSTGRESQL else None
    if measure:
        original_result = await measure(config, original.normalized_sql, warmups, iterations, ordered)
        candidate_result = await measure(config, candidate.normalized_sql, warmups, iterations, ordered)
    else:
        original_result = await asyncio.to_thread(
            _measure_snowflake_sync, config, original.normalized_sql, warmups, iterations, ordered
        )
        candidate_result = await asyncio.to_thread(
            _measure_snowflake_sync, config, candidate.normalized_sql, warmups, iterations, ordered
        )
    if original_result.truncated or candidate_result.truncated:
        agreement = "inconclusive_truncated"
    elif original_result.row_count != candidate_result.row_count:
        agreement = "different_row_count"
    elif original_result.result_digest == candidate_result.result_digest:
        agreement = "empirical_match"
    else:
        agreement = "different_results"
    caveats = [
        "Empirical agreement on one dataset is not formal query equivalence.",
        "Latency includes database execution and result transfer to DataCurrent.",
    ]
    if not ordered:
        caveats.append("Rows were compared as a multiset because neither query declared ordering.")
    return BenchmarkComparison(
        original=original_result,
        candidate=candidate_result,
        speedup_ratio=(original_result.median_ms / candidate_result.median_ms)
        if candidate_result.median_ms > 0
        else float("inf"),
        result_agreement=agreement,
        caveats=caveats,
    )
