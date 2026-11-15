import uuid

from pydantic import BaseModel, Field


class BenchmarkRequest(BaseModel):
    connection_id: uuid.UUID
    recommendation_id: uuid.UUID | None = None
    original_sql: str = Field(min_length=1, max_length=200_000)
    candidate_sql: str = Field(min_length=1, max_length=200_000)
    warmup_iterations: int = Field(default=2, ge=0, le=20)
    measured_iterations: int = Field(default=10, ge=3, le=100)


class MeasurementResponse(BaseModel):
    latencies_ms: list[float]
    median_ms: float
    p95_ms: float
    row_count: int
    truncated: bool


class BenchmarkResponse(BaseModel):
    benchmark_id: uuid.UUID
    status: str
    original: MeasurementResponse
    candidate: MeasurementResponse
    speedup_ratio: float
    result_agreement: str
    caveats: list[str]
