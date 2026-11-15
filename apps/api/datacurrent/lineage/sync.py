import asyncio
from typing import Any

import psycopg
from psycopg.rows import dict_row
from snowflake.connector import DictCursor
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from datacurrent.connectors import connector_for
from datacurrent.connectors.postgresql import PostgreSQLConnector
from datacurrent.connectors.snowflake import SnowflakeConnector
from datacurrent.core.crypto import decrypt_config
from datacurrent.models.entities import (
    CatalogSchema,
    CatalogTable,
    DatabaseConnection,
    DatabaseProvider,
    EvidenceKind,
    LineageEdge,
    LineageNode,
)


async def sync_catalog(db: AsyncSession, connection: DatabaseConnection) -> int:
    config = decrypt_config(connection.encrypted_config)
    objects = await connector_for(connection.provider, config).discover()
    count = 0
    for item in objects:
        schema_id = await db.scalar(
            insert(CatalogSchema)
            .values(
                connection_id=connection.id,
                external_id=item.schema_name,
                name=item.schema_name,
            )
            .on_conflict_do_update(
                constraint="uq_catalog_schemas_connection_id",
                set_={"name": item.schema_name},
            )
            .returning(CatalogSchema.id)
        )
        table_id = await db.scalar(
            insert(CatalogTable)
            .values(
                schema_id=schema_id,
                external_id=item.external_id,
                name=item.name,
                kind=item.kind,
                estimated_rows=item.metadata.get("estimated_rows"),
                size_bytes=item.metadata.get("size_bytes"),
                statistics=item.metadata,
            )
            .on_conflict_do_update(
                constraint="uq_catalog_tables_schema_id",
                set_={
                    "name": item.name,
                    "kind": item.kind,
                    "estimated_rows": item.metadata.get("estimated_rows"),
                    "size_bytes": item.metadata.get("size_bytes"),
                    "statistics": item.metadata,
                },
            )
            .returning(CatalogTable.id)
        )
        await db.execute(
            insert(LineageNode)
            .values(
                workspace_id=connection.workspace_id,
                connection_id=connection.id,
                catalog_table_id=table_id,
                external_id=item.external_id,
                label=f"{item.schema_name}.{item.name}",
                kind=item.kind,
                metadata_json=item.metadata,
            )
            .on_conflict_do_update(
                constraint="uq_lineage_nodes_connection_id",
                set_={"label": f"{item.schema_name}.{item.name}", "metadata_json": item.metadata},
            )
        )
        count += 1
    await db.commit()
    return count


async def _postgres_dependencies(config: dict[str, Any]) -> list[dict[str, str]]:
    connector = PostgreSQLConnector(config)
    query = """
        SELECT source_ns.nspname || '.' || source.relname AS source_id,
               target_ns.nspname || '.' || target.relname AS target_id,
               CASE WHEN con.oid IS NOT NULL THEN 'foreign_key' ELSE 'view_dependency' END AS relationship
          FROM pg_depend dep
          JOIN pg_class source ON source.oid = dep.objid
          JOIN pg_namespace source_ns ON source_ns.oid = source.relnamespace
          JOIN pg_class target ON target.oid = dep.refobjid
          JOIN pg_namespace target_ns ON target_ns.oid = target.relnamespace
          LEFT JOIN pg_constraint con ON con.oid = dep.objid AND con.contype = 'f'
         WHERE source_ns.nspname NOT IN ('pg_catalog', 'information_schema')
           AND target_ns.nspname NOT IN ('pg_catalog', 'information_schema')
           AND source.oid <> target.oid
        UNION
        SELECT src_ns.nspname || '.' || src.relname,
               tgt_ns.nspname || '.' || tgt.relname,
               'foreign_key'
          FROM pg_constraint fk
          JOIN pg_class src ON src.oid = fk.conrelid
          JOIN pg_namespace src_ns ON src_ns.oid = src.relnamespace
          JOIN pg_class tgt ON tgt.oid = fk.confrelid
          JOIN pg_namespace tgt_ns ON tgt_ns.oid = tgt.relnamespace
         WHERE fk.contype = 'f'
    """
    async with await psycopg.AsyncConnection.connect(
        **connector._kwargs(), row_factory=dict_row
    ) as conn:
        rows = await (await conn.execute(query)).fetchall()
    return list(rows)


def _snowflake_dependencies_sync(config: dict[str, Any]) -> list[dict[str, str]]:
    connector = SnowflakeConnector(config)
    with connector._connect() as conn:
        with conn.cursor(DictCursor) as cursor:
            cursor.execute(
                """
                SELECT REFERENCING_DATABASE || '.' || REFERENCING_SCHEMA || '.' || REFERENCING_OBJECT_NAME AS source_id,
                       REFERENCED_DATABASE || '.' || REFERENCED_SCHEMA || '.' || REFERENCED_OBJECT_NAME AS target_id,
                       'object_dependency' AS relationship
                  FROM SNOWFLAKE.ACCOUNT_USAGE.OBJECT_DEPENDENCIES
                 WHERE REFERENCED_OBJECT_DOMAIN IN ('TABLE', 'VIEW', 'MATERIALIZED VIEW')
                   AND REFERENCING_OBJECT_DOMAIN IN ('TABLE', 'VIEW', 'MATERIALIZED VIEW')
                """
            )
            return [dict(row) for row in cursor.fetchall()]


async def sync_dependencies(db: AsyncSession, connection: DatabaseConnection) -> int:
    config = decrypt_config(connection.encrypted_config)
    if connection.provider is DatabaseProvider.POSTGRESQL:
        dependencies = await _postgres_dependencies(config)
    else:
        dependencies = await asyncio.to_thread(_snowflake_dependencies_sync, config)
    nodes = list(
        (
            await db.scalars(select(LineageNode).where(LineageNode.connection_id == connection.id))
        ).all()
    )
    by_external = {node.external_id.lower(): node for node in nodes}
    by_label = {node.label.lower(): node for node in nodes}
    count = 0
    for dependency in dependencies:
        source = by_external.get(dependency["source_id"].lower()) or by_label.get(
            dependency["source_id"].lower()
        )
        target = by_external.get(dependency["target_id"].lower()) or by_label.get(
            dependency["target_id"].lower()
        )
        if not source or not target:
            continue
        await db.execute(
            insert(LineageEdge)
            .values(
                workspace_id=connection.workspace_id,
                source_node_id=source.id,
                target_node_id=target.id,
                relationship=dependency["relationship"],
                evidence_kind=EvidenceKind.OBSERVED,
                evidence={"source": "database_catalog"},
            )
            .on_conflict_do_update(
                constraint="uq_lineage_edges_source_node_id",
                set_={"evidence": {"source": "database_catalog"}},
            )
        )
        count += 1
    await db.commit()
    return count
