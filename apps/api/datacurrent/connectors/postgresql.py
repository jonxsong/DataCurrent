import time
from typing import Any

import psycopg
from psycopg.rows import dict_row

from datacurrent.connectors.base import ConnectionTestResult, DatabaseConnector, DiscoveredObject
from datacurrent.connectors.network import validate_database_host
from datacurrent.core.config import get_settings


class PostgreSQLConnector(DatabaseConnector):
    def __init__(self, config: dict[str, Any]):
        self.config = config

    def _kwargs(self) -> dict[str, Any]:
        return {
            "host": self.config["host"],
            "port": self.config.get("port", 5432),
            "dbname": self.config["database"],
            "user": self.config["username"],
            "password": self.config["password"],
            "sslmode": self.config.get("ssl_mode", "verify-full"),
            "connect_timeout": 8,
            "application_name": "datacurrent",
            "options": f"-c statement_timeout={get_settings().query_timeout_ms} -c default_transaction_read_only=on",
        }

    async def test(self) -> ConnectionTestResult:
        await validate_database_host(self.config["host"], self.config.get("port", 5432))
        started = time.perf_counter()
        async with await psycopg.AsyncConnection.connect(**self._kwargs(), row_factory=dict_row) as conn:
            await conn.set_read_only(True)
            row = await (await conn.execute("SELECT version() AS version, current_setting('server_version_num') AS version_num")).fetchone()
            extension = await (
                await conn.execute("SELECT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_stat_statements') AS enabled")
            ).fetchone()
        latency = round((time.perf_counter() - started) * 1000, 2)
        pgss = bool(extension and extension["enabled"])
        return ConnectionTestResult(
            ok=True,
            latency_ms=latency,
            server_version=row["version"] if row else None,
            capabilities={
                "query_statistics": pgss,
                "execution_plans": True,
                "catalog_discovery": True,
                "lineage": True,
            },
            guidance=[] if pgss else ["Install and grant access to pg_stat_statements for query metrics."],
        )

    async def discover(self) -> list[DiscoveredObject]:
        await validate_database_host(self.config["host"], self.config.get("port", 5432))
        query = """
            SELECT n.nspname AS schema_name, c.relname AS object_name,
                   c.oid::text AS external_id,
                   CASE c.relkind WHEN 'r' THEN 'table' WHEN 'p' THEN 'partitioned_table'
                        WHEN 'v' THEN 'view' WHEN 'm' THEN 'materialized_view' ELSE 'other' END AS kind,
                   pg_total_relation_size(c.oid) AS size_bytes,
                   GREATEST(c.reltuples::bigint, 0) AS estimated_rows
              FROM pg_class c
              JOIN pg_namespace n ON n.oid = c.relnamespace
             WHERE n.nspname NOT IN ('pg_catalog', 'information_schema')
               AND n.nspname !~ '^pg_toast'
               AND c.relkind IN ('r', 'p', 'v', 'm')
             ORDER BY n.nspname, c.relname
        """
        async with await psycopg.AsyncConnection.connect(**self._kwargs(), row_factory=dict_row) as conn:
            rows = await (await conn.execute(query)).fetchall()
        return [
            DiscoveredObject(
                external_id=row["external_id"],
                schema_name=row["schema_name"],
                name=row["object_name"],
                kind=row["kind"],
                metadata={"size_bytes": row["size_bytes"], "estimated_rows": row["estimated_rows"]},
            )
            for row in rows
        ]
