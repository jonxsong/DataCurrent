import platform
import uuid

from datacurrent.api.dependencies import require_role
from datacurrent.core.crypto import decrypt_config
from datacurrent.core.database import get_db
from datacurrent.core.errors import DataCurrentError
from datacurrent.models.entities import (
    BenchmarkRun,
    DatabaseConnection,
    WorkspaceMembership,
    WorkspaceRole,
)
from datacurrent.schemas.benchmarks import (
    BenchmarkRequest,
    BenchmarkResponse,
    BenchmarkRunSummary,
    MeasurementResponse,
)
from datacurrent.verification.benchmark import compare_queries
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(prefix="/workspaces/{workspace_id}/benchmarks", tags=["benchmarks"])


@router.get("", response_model=list[BenchmarkRunSummary])
async def list_benchmarks(
    workspace_id: uuid.UUID,
    _membership: WorkspaceMembership = Depends(require_role(WorkspaceRole.VIEWER)),
    db: AsyncSession = Depends(get_db),
) -> list[BenchmarkRunSummary]:
    rows = list(
        (
            await db.scalars(
                select(BenchmarkRun)
                .where(BenchmarkRun.workspace_id == workspace_id)
                .order_by(BenchmarkRun.created_at.desc())
                .limit(50)
            )
        ).all()
    )
    return [
        BenchmarkRunSummary(
            id=row.id,
            connection_id=row.connection_id,
            status=row.status,
            original_sql=row.original_sql,
            candidate_sql=row.candidate_sql,
            original_median_ms=row.original_median_ms,
            candidate_median_ms=row.candidate_median_ms,
            original_p95_ms=row.original_p95_ms,
            candidate_p95_ms=row.candidate_p95_ms,
            speedup_ratio=(
                float(row.original_median_ms / row.candidate_median_ms)
                if row.original_median_ms is not None
                and row.candidate_median_ms is not None
                and row.candidate_median_ms > 0
                else None
            ),
            result_agreement=row.result_agreement,
            warmup_iterations=row.warmup_iterations,
            measured_iterations=row.measured_iterations,
            environment=row.environment,
            methodology=row.methodology,
            caveats=row.raw_measurements.get("caveats", []),
            created_at=row.created_at,
        )
        for row in rows
    ]


@router.post("", response_model=BenchmarkResponse, status_code=201)
async def run_benchmark(
    workspace_id: uuid.UUID,
    payload: BenchmarkRequest,
    _membership: WorkspaceMembership = Depends(require_role(WorkspaceRole.MEMBER)),
    db: AsyncSession = Depends(get_db),
) -> BenchmarkResponse:
    connection = await db.scalar(
        select(DatabaseConnection).where(
            DatabaseConnection.id == payload.connection_id,
            DatabaseConnection.workspace_id == workspace_id,
        )
    )
    if not connection:
        raise DataCurrentError("Connection not found", code="connection_not_found", status_code=404)
    if not connection.benchmark_only:
        raise DataCurrentError(
            "Benchmarks require a connection explicitly marked as an isolated benchmark database",
            code="benchmark_connection_required",
            status_code=409,
        )
    record = BenchmarkRun(
        workspace_id=workspace_id,
        recommendation_id=payload.recommendation_id,
        connection_id=connection.id,
        original_sql=payload.original_sql,
        candidate_sql=payload.candidate_sql,
        status="running",
        warmup_iterations=payload.warmup_iterations,
        measured_iterations=payload.measured_iterations,
        environment={"provider": connection.provider.value, "runner": platform.platform()},
        methodology={
            "warmups": payload.warmup_iterations,
            "iterations": payload.measured_iterations,
            "result_limit": 10_000,
        },
    )
    db.add(record)
    await db.flush()
    result = await compare_queries(
        connection.provider,
        decrypt_config(connection.encrypted_config),
        payload.original_sql,
        payload.candidate_sql,
        warmups=payload.warmup_iterations,
        iterations=payload.measured_iterations,
    )
    record.status = "complete"
    record.original_median_ms = result.original.median_ms
    record.candidate_median_ms = result.candidate.median_ms
    record.original_p95_ms = result.original.p95_ms
    record.candidate_p95_ms = result.candidate.p95_ms
    record.result_agreement = result.result_agreement
    record.raw_measurements = {
        "original": result.original.latencies_ms,
        "candidate": result.candidate.latencies_ms,
        "caveats": result.caveats,
    }
    await db.commit()
    return BenchmarkResponse(
        benchmark_id=record.id,
        status=record.status,
        original=MeasurementResponse(
            **{k: v for k, v in result.original.__dict__.items() if k != "result_digest"}
        ),
        candidate=MeasurementResponse(
            **{k: v for k, v in result.candidate.__dict__.items() if k != "result_digest"}
        ),
        speedup_ratio=result.speedup_ratio,
        result_agreement=result.result_agreement,
        caveats=result.caveats,
    )
