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
    CatalogColumn,
    CatalogIndex,
    CatalogSchema,
    CatalogTable,
    DatabaseConnection,
    DatabaseProvider,
    EvidenceKind,
    LineageEdge,
    LineageNode,
)


async def _postgres_catalog_details(
    config: dict[str, Any],
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    connector = PostgreSQLConnector(config)
    columns_query = """
        SELECT c.table_schema AS schema_name, c.table_name, c.column_name,
               c.ordinal_position, c.data_type, c.is_nullable = 'YES' AS nullable,
               c.column_default,
               EXISTS (
                   SELECT 1 FROM information_schema.table_constraints tc
                   JOIN information_schema.key_column_usage kcu
                     ON kcu.constraint_name = tc.constraint_name
                    AND kcu.constraint_schema = tc.constraint_schema
                  WHERE tc.constraint_type = 'PRIMARY KEY'
                    AND tc.table_schema = c.table_schema
                    AND tc.table_name = c.table_name
                    AND kcu.column_name = c.column_name
               ) AS is_primary_key
          FROM information_schema.columns c
         WHERE c.table_schema NOT IN ('pg_catalog', 'information_schema')
         ORDER BY c.table_schema, c.table_name, c.ordinal_position
    """
    indexes_query = """
        SELECT ns.nspname AS schema_name, tbl.relname AS table_name,
               idx.relname AS index_name, pg_get_indexdef(i.indexrelid) AS definition,
               ARRAY(
                   SELECT att.attname
                     FROM unnest(i.indkey) WITH ORDINALITY AS keys(attnum, ord)
                     JOIN pg_attribute att ON att.attrelid = tbl.oid AND att.attnum = keys.attnum
                    ORDER BY keys.ord
               ) AS column_names,
               i.indisunique AS is_unique, i.indisprimary AS is_primary,
               pg_relation_size(idx.oid) AS size_bytes, COALESCE(stats.idx_scan, 0) AS scan_count
          FROM pg_index i
          JOIN pg_class idx ON idx.oid = i.indexrelid
          JOIN pg_class tbl ON tbl.oid = i.indrelid
          JOIN pg_namespace ns ON ns.oid = tbl.relnamespace
          LEFT JOIN pg_stat_user_indexes stats ON stats.indexrelid = idx.oid
         WHERE ns.nspname NOT IN ('pg_catalog', 'information_schema')
    """
    async with await psycopg.AsyncConnection.connect(
        **connector._kwargs(), row_factory=dict_row
    ) as conn:
        columns = list(await (await conn.execute(columns_query)).fetchall())
        indexes = list(await (await conn.execute(indexes_query)).fetchall())
    return columns, indexes


def _snowflake_columns_sync(config: dict[str, Any]) -> list[dict[str, Any]]:
    connector = SnowflakeConnector(config)
    with connector._connect() as conn:
        with conn.cursor(DictCursor) as cursor:
            cursor.execute(
                """
                SELECT TABLE_SCHEMA AS schema_name, TABLE_NAME AS table_name,
                       COLUMN_NAME AS column_name, ORDINAL_POSITION,
                       DATA_TYPE, IS_NULLABLE = 'YES' AS nullable,
                       COLUMN_DEFAULT, FALSE AS is_primary_key
                  FROM INFORMATION_SCHEMA.COLUMNS
                 WHERE TABLE_SCHEMA <> 'INFORMATION_SCHEMA'
                 ORDER BY TABLE_SCHEMA, TABLE_NAME, ORDINAL_POSITION
                """
            )
            return [
                {str(key).lower(): value for key, value in dict(row).items()}
                for row in cursor.fetchall()
            ]


async def sync_catalog_details(db: AsyncSession, connection: DatabaseConnection) -> int:
    config = decrypt_config(connection.encrypted_config)
    if connection.provider is DatabaseProvider.POSTGRESQL:
        columns, indexes = await _postgres_catalog_details(config)
    else:
        columns = await asyncio.to_thread(_snowflake_columns_sync, config)
        indexes = []
    catalog_rows = (
        await db.execute(
            select(CatalogTable, CatalogSchema)
            .join(CatalogSchema, CatalogSchema.id == CatalogTable.schema_id)
            .where(CatalogSchema.connection_id == connection.id)
        )
    ).all()
    by_name = {(schema.name.lower(), table.name.lower()): table for table, schema in catalog_rows}
    count = 0
    for column in columns:
        table = by_name.get((column["schema_name"].lower(), column["table_name"].lower()))
        if not table:
            continue
        await db.execute(
            insert(CatalogColumn)
            .values(
                table_id=table.id,
                name=column["column_name"],
                ordinal_position=column["ordinal_position"],
                data_type=column["data_type"],
                nullable=column["nullable"],
                default_expression=column["column_default"],
                is_primary_key=column["is_primary_key"],
            )
            .on_conflict_do_update(
                constraint="uq_catalog_columns_table_id",
                set_={
                    "ordinal_position": column["ordinal_position"],
                    "data_type": column["data_type"],
                    "nullable": column["nullable"],
                    "default_expression": column["column_default"],
                    "is_primary_key": column["is_primary_key"],
                },
            )
        )
        count += 1
    for index in indexes:
        table = by_name.get((index["schema_name"].lower(), index["table_name"].lower()))
        if not table:
            continue
        await db.execute(
            insert(CatalogIndex)
            .values(
                table_id=table.id,
                name=index["index_name"],
                definition=index["definition"],
                column_names=index["column_names"],
                is_unique=index["is_unique"],
                is_primary=index["is_primary"],
                size_bytes=index["size_bytes"],
                scan_count=index["scan_count"],
            )
            .on_conflict_do_update(
                constraint="uq_catalog_indexes_table_id",
                set_={
                    "definition": index["definition"],
                    "column_names": index["column_names"],
                    "is_unique": index["is_unique"],
                    "is_primary": index["is_primary"],
                    "size_bytes": index["size_bytes"],
                    "scan_count": index["scan_count"],
                },
            )
        )
        count += 1
    await db.commit()
    return count


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
