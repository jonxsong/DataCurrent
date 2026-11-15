import asyncio
import json
from typing import Any

import psycopg
from psycopg.rows import dict_row

from datacurrent.analysis.plans import Finding, analyze_plan, parse_postgres_plan
from datacurrent.analysis.sql import ParsedQuery, assert_read_only_select, parse_query
from datacurrent.connectors.postgresql import PostgreSQLConnector
from datacurrent.connectors.snowflake import SnowflakeConnector
from datacurrent.models.entities import DatabaseProvider


async def explain_postgresql(config: dict[str, Any], sql: str) -> tuple[dict[str, Any], list[Finding]]:
    connector = PostgreSQLConnector(config)
    async with await psycopg.AsyncConnection.connect(**connector._kwargs(), row_factory=dict_row) as conn:
        await conn.set_read_only(True)
        async with conn.transaction():
            row = await (await conn.execute(f"EXPLAIN (FORMAT JSON, ANALYZE FALSE, VERBOSE TRUE) {sql}")).fetchone()
    if not row:
        raise ValueError("PostgreSQL returned no execution plan")
    payload = next(iter(row.values()))
    node = parse_postgres_plan(payload)
    return {"raw": payload, "tree": node.to_dict()}, analyze_plan(node)


def _explain_snowflake_sync(config: dict[str, Any], sql: str) -> dict[str, Any]:
    connector = SnowflakeConnector(config)
    with connector._connect() as conn:
        with conn.cursor() as cursor:
            cursor.execute(f"EXPLAIN USING JSON {sql}")
            row = cursor.fetchone()
    if not row:
        raise ValueError("Snowflake returned no query plan")
    value = row[0]
    return json.loads(value) if isinstance(value, str) else value


async def explain_query(
    provider: DatabaseProvider, config: dict[str, Any], sql: str
) -> tuple[ParsedQuery, dict[str, Any], list[Finding]]:
    dialect = "postgres" if provider is DatabaseProvider.POSTGRESQL else "snowflake"
    parsed = parse_query(sql, dialect=dialect)
    assert_read_only_select(parsed)
    if provider is DatabaseProvider.POSTGRESQL:
        plan, findings = await explain_postgresql(config, parsed.normalized_sql)
    else:
        raw = await asyncio.to_thread(_explain_snowflake_sync, config, parsed.normalized_sql)
        plan = {"raw": raw, "tree": None}
        findings = []
    return parsed, plan, findings
