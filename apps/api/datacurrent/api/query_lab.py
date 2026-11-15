import uuid

from datacurrent.api.dependencies import require_role
from datacurrent.core.crypto import decrypt_config
from datacurrent.core.database import get_db
from datacurrent.core.errors import DataCurrentError
from datacurrent.models.entities import (
    DatabaseConnection,
    ExecutionPlan,
    WorkspaceMembership,
    WorkspaceRole,
)
from datacurrent.schemas.query_lab import AnalyzeQueryRequest, AnalyzeQueryResponse, FindingResponse
from datacurrent.services.query_lab import explain_query
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(prefix="/workspaces/{workspace_id}/query-lab", tags=["query-lab"])


@router.post("/analyze", response_model=AnalyzeQueryResponse)
async def analyze_query(
    workspace_id: uuid.UUID,
    payload: AnalyzeQueryRequest,
    _membership: WorkspaceMembership = Depends(require_role(WorkspaceRole.MEMBER)),
    db: AsyncSession = Depends(get_db),
) -> AnalyzeQueryResponse:
    connection = await db.scalar(
        select(DatabaseConnection).where(
            DatabaseConnection.id == payload.connection_id,
            DatabaseConnection.workspace_id == workspace_id,
        )
    )
    if not connection:
        raise DataCurrentError("Connection not found", code="connection_not_found", status_code=404)
    parsed, plan_payload, findings = await explain_query(
        connection.provider,
        decrypt_config(connection.encrypted_config),
        payload.sql,
    )
    plan = ExecutionPlan(
        workspace_id=workspace_id,
        provider=connection.provider,
        plan_json=plan_payload["raw"],
        analyzed=False,
        heuristics=[finding.__dict__ for finding in findings],
    )
    db.add(plan)
    await db.commit()
    await db.refresh(plan)
    return AnalyzeQueryResponse(
        plan_id=plan.id,
        provider=connection.provider.value,
        parsed_query={
            "operation": parsed.operation,
            "normalized_sql": parsed.normalized_sql,
            "redacted_sql": parsed.redacted_sql,
            "fingerprint": parsed.fingerprint,
            "referenced_tables": parsed.referenced_tables,
        },
        plan=plan_payload,
        findings=[FindingResponse(**finding.__dict__) for finding in findings],
        safety={
            "query_executed": False,
            "explain_analyze": False,
            "read_only_session": True,
            "statement_timeout_enforced": True,
        },
    )
