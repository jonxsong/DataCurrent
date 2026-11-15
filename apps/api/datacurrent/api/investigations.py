import uuid

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from datacurrent.ai.investigator import InvestigationContext, run_investigator
from datacurrent.api.dependencies import current_user, require_role
from datacurrent.core.database import get_db
from datacurrent.core.errors import DataCurrentError
from datacurrent.models.entities import (
    EvidenceKind,
    ExecutionPlan,
    Investigation,
    OptimizationRecommendation,
    QueryFingerprint,
    QueryMetricSnapshot,
    User,
    WorkspaceMembership,
    WorkspaceRole,
)
from datacurrent.schemas.investigations import InvestigationRequest, InvestigationResponse


router = APIRouter(prefix="/workspaces/{workspace_id}/investigations", tags=["investigations"])


@router.post("", response_model=InvestigationResponse, status_code=201)
async def investigate(
    workspace_id: uuid.UUID,
    payload: InvestigationRequest,
    user: User = Depends(current_user),
    _membership: WorkspaceMembership = Depends(require_role(WorkspaceRole.MEMBER)),
    db: AsyncSession = Depends(get_db),
) -> InvestigationResponse:
    query = None
    if payload.query_id:
        query = await db.scalar(
            select(QueryFingerprint)
            .join(QueryMetricSnapshot, QueryMetricSnapshot.query_id == QueryFingerprint.id)
            .where(
                QueryFingerprint.id == payload.query_id,
                QueryMetricSnapshot.workspace_id == workspace_id,
            )
            .limit(1)
        )
        if not query:
            raise DataCurrentError("Query not found", code="query_not_found", status_code=404)
    plan = None
    if payload.plan_id:
        plan = await db.scalar(
            select(ExecutionPlan).where(
                ExecutionPlan.id == payload.plan_id,
                ExecutionPlan.workspace_id == workspace_id,
            )
        )
        if not plan:
            raise DataCurrentError("Plan not found", code="plan_not_found", status_code=404)
    metric_rows = []
    if query:
        metrics = (
            await db.scalars(
                select(QueryMetricSnapshot)
                .where(
                    QueryMetricSnapshot.query_id == query.id,
                    QueryMetricSnapshot.workspace_id == workspace_id,
                )
                .order_by(QueryMetricSnapshot.captured_at.desc())
                .limit(48)
            )
        ).all()
        metric_rows = [
            {
                "source_id": str(metric.id),
                "captured_at": metric.captured_at,
                "mean_time_ms": metric.mean_time_ms,
                "calls": metric.calls,
                "total_time_ms": metric.total_time_ms,
                "is_cumulative": metric.is_cumulative,
            }
            for metric in metrics
        ]
    context = InvestigationContext(
        query={
            "source_id": str(query.id) if query else None,
            "redacted_sql": query.normalized_sql if query else None,
            "operation": query.operation if query else None,
            "referenced_objects": query.referenced_objects if query else [],
        },
        plan={
            "source_id": str(plan.id) if plan else None,
            "plan": plan.plan_json if plan else None,
            "heuristics": plan.heuristics if plan else [],
        },
        metrics=metric_rows,
    )
    record = Investigation(
        workspace_id=workspace_id,
        created_by_id=user.id,
        query_id=query.id if query else None,
        plan_id=plan.id if plan else None,
        title=payload.question[:240],
        status="running",
        question=payload.question,
    )
    db.add(record)
    await db.flush()
    report = await run_investigator(payload.question, context)
    record.status = "complete"
    record.summary = report.summary
    record.evidence_refs = [
        evidence.model_dump()
        for finding in report.findings
        for evidence in finding.evidence
    ]
    for finding in report.findings:
        if finding.recommendation:
            db.add(
                OptimizationRecommendation(
                    investigation_id=record.id,
                    finding=finding.title,
                    evidence=[item.model_dump() for item in finding.evidence],
                    recommendation=finding.recommendation,
                    proposed_sql=finding.proposed_sql,
                    tradeoffs=finding.tradeoffs,
                    confidence=finding.confidence,
                    evidence_kind=EvidenceKind(finding.kind),
                )
            )
    await db.commit()
    return InvestigationResponse(investigation_id=record.id, report=report)
