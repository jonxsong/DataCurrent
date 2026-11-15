import asyncio
import time
from typing import Any

import snowflake.connector

from datacurrent.connectors.base import ConnectionTestResult, DatabaseConnector, DiscoveredObject


class SnowflakeConnector(DatabaseConnector):
    def __init__(self, config: dict[str, Any]):
        self.config = config

    def _connect(self) -> Any:
        return snowflake.connector.connect(
            account=self.config["account"],
            user=self.config["username"],
            password=self.config["password"],
            warehouse=self.config.get("warehouse"),
            database=self.config.get("database"),
            schema=self.config.get("schema"),
            role=self.config.get("role"),
            login_timeout=8,
            network_timeout=15,
            session_parameters={
                "QUERY_TAG": "datacurrent",
                "STATEMENT_TIMEOUT_IN_SECONDS": 15,
            },
        )

    def _test_sync(self) -> ConnectionTestResult:
        started = time.perf_counter()
        with self._connect() as conn:
            with conn.cursor() as cursor:
                cursor.execute("SELECT CURRENT_VERSION(), CURRENT_REGION(), CURRENT_ROLE()")
                version, region, role = cursor.fetchone()
        return ConnectionTestResult(
            ok=True,
            latency_ms=round((time.perf_counter() - started) * 1000, 2),
            server_version=str(version),
            capabilities={
                "query_history": True,
                "query_profile": True,
                "catalog_discovery": True,
                "lineage": True,
                "region": region,
                "role": role,
            },
        )

    async def test(self) -> ConnectionTestResult:
        return await asyncio.to_thread(self._test_sync)

    def _discover_sync(self) -> list[DiscoveredObject]:
        with self._connect() as conn:
            with conn.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT TABLE_CATALOG, TABLE_SCHEMA, TABLE_NAME, TABLE_TYPE, ROW_COUNT, BYTES
                      FROM INFORMATION_SCHEMA.TABLES
                     WHERE TABLE_SCHEMA <> 'INFORMATION_SCHEMA'
                     ORDER BY TABLE_SCHEMA, TABLE_NAME
                    """
                )
                rows = cursor.fetchall()
        return [
            DiscoveredObject(
                external_id=f"{catalog}.{schema}.{name}",
                schema_name=schema,
                name=name,
                kind="view" if "VIEW" in table_type else "table",
                metadata={"estimated_rows": row_count, "size_bytes": size_bytes, "catalog": catalog},
            )
            for catalog, schema, name, table_type, row_count, size_bytes in rows
        ]

    async def discover(self) -> list[DiscoveredObject]:
        return await asyncio.to_thread(self._discover_sync)
