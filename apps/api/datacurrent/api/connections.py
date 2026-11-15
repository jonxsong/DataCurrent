import hashlib
import json
import uuid
from datetime import UTC, datetime

from datacurrent.api.dependencies import require_role, workspace_membership
from datacurrent.connectors import connector_for
from datacurrent.core.crypto import decrypt_config, encrypt_config
from datacurrent.core.database import get_db
from datacurrent.core.errors import DataCurrentError
from datacurrent.models.entities import (
    ConnectionStatus,
    DatabaseConnection,
    DatabaseProvider,
    WorkspaceMembership,
    WorkspaceRole,
)
from datacurrent.schemas.connections import (
    ConnectionCreate,
    ConnectionResponse,
    ConnectionTestResponse,
)
from fastapi import APIRouter, Depends
from psycopg import OperationalError as PostgreSQLOperationalError
from snowflake.connector.errors import Error as SnowflakeError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(prefix="/workspaces/{workspace_id}/connections", tags=["connections"])


async def test_connector(
    provider: DatabaseProvider, config: dict[str, object]
) -> ConnectionTestResponse:
    try:
        result = await connector_for(provider, config).test()
    except DataCurrentError:
        raise
    except (PostgreSQLOperationalError, SnowflakeError, OSError, TimeoutError) as exc:
        raise DataCurrentError(
            "Connection test failed. Verify the host, credentials, TLS mode, and network policy.",
            code="connection_test_failed",
            status_code=422,
        ) from exc
    return ConnectionTestResponse(**result.__dict__)


def config_dict(payload: ConnectionCreate) -> dict[str, object]:
    raw = payload.config.model_dump(by_alias=True)
    raw["provider"] = payload.config.provider.value
    password = raw.get("password")
    if hasattr(password, "get_secret_value"):
        raw["password"] = password.get_secret_value()
    return raw


@router.get("", response_model=list[ConnectionResponse])
async def list_connections(
    workspace_id: uuid.UUID,
    _membership: WorkspaceMembership = Depends(workspace_membership),
    db: AsyncSession = Depends(get_db),
) -> list[DatabaseConnection]:
    return list(
        (
            await db.scalars(
                select(DatabaseConnection)
                .where(DatabaseConnection.workspace_id == workspace_id)
                .order_by(DatabaseConnection.name)
            )
        ).all()
    )


@router.post("/test", response_model=ConnectionTestResponse)
async def test_connection(
    workspace_id: uuid.UUID,
    payload: ConnectionCreate,
    _membership: WorkspaceMembership = Depends(require_role(WorkspaceRole.ADMIN)),
) -> ConnectionTestResponse:
    return await test_connector(payload.config.provider, config_dict(payload))


@router.post("", response_model=ConnectionResponse, status_code=201)
async def create_connection(
    workspace_id: uuid.UUID,
    payload: ConnectionCreate,
    _membership: WorkspaceMembership = Depends(require_role(WorkspaceRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
) -> DatabaseConnection:
    raw = config_dict(payload)
    result = await test_connector(payload.config.provider, raw)
    canonical = json.dumps({k: v for k, v in raw.items() if k != "password"}, sort_keys=True)
    connection = DatabaseConnection(
        workspace_id=workspace_id,
        name=payload.name.strip(),
        provider=payload.config.provider,
        status=ConnectionStatus.HEALTHY,
        encrypted_config=encrypt_config(raw),
        config_fingerprint=hashlib.sha256(canonical.encode()).hexdigest(),
        capabilities=result.capabilities,
        tls_verify=raw.get("ssl_mode", "verify-full") in {"verify-full", "verify-ca"},
        benchmark_only=payload.benchmark_only,
        last_checked_at=datetime.now(UTC),
    )
    db.add(connection)
    await db.commit()
    await db.refresh(connection)
    return connection


@router.post("/{connection_id}/test", response_model=ConnectionTestResponse)
async def retest_connection(
    workspace_id: uuid.UUID,
    connection_id: uuid.UUID,
    _membership: WorkspaceMembership = Depends(require_role(WorkspaceRole.MEMBER)),
    db: AsyncSession = Depends(get_db),
) -> ConnectionTestResponse:
    connection = await db.scalar(
        select(DatabaseConnection).where(
            DatabaseConnection.id == connection_id,
            DatabaseConnection.workspace_id == workspace_id,
        )
    )
    if not connection:
        raise DataCurrentError("Connection not found", code="connection_not_found", status_code=404)
    result = await test_connector(connection.provider, decrypt_config(connection.encrypted_config))
    connection.status = ConnectionStatus.HEALTHY
    connection.last_checked_at = datetime.now(UTC)
    connection.last_error_code = None
    connection.capabilities = result.capabilities
    await db.commit()
    return result


@router.delete("/{connection_id}", status_code=204)
async def delete_connection(
    workspace_id: uuid.UUID,
    connection_id: uuid.UUID,
    _membership: WorkspaceMembership = Depends(require_role(WorkspaceRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
) -> None:
    connection = await db.scalar(
        select(DatabaseConnection).where(
            DatabaseConnection.id == connection_id,
            DatabaseConnection.workspace_id == workspace_id,
        )
    )
    if not connection:
        raise DataCurrentError("Connection not found", code="connection_not_found", status_code=404)
    await db.delete(connection)
    await db.commit()
