import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, Field


class QuerySummary(BaseModel):
    id: uuid.UUID
    connection_id: uuid.UUID
    provider: str
    fingerprint_hash: str
    normalized_sql: str
    operation: str | None
    calls: int
    mean_time_ms: Decimal
    total_time_ms: Decimal
    rows_processed: int
    captured_at: datetime
    sample_kind: str


class QueryPage(BaseModel):
    items: list[QuerySummary]
    page: int
    page_size: int
    total: int


class QueryTrendPoint(BaseModel):
    captured_at: datetime
    mean_time_ms: Decimal
    calls_delta: int | None
    total_time_delta_ms: Decimal | None
    counter_reset: bool


class QueryDetail(QuerySummary):
    referenced_objects: list[str]
    first_seen_at: datetime
    last_seen_at: datetime
    trend: list[QueryTrendPoint]


class OverviewMetric(BaseModel):
    value: Decimal | int | None
    previous_value: Decimal | int | None = None
    available: bool = True
    note: str | None = None


class OverviewResponse(BaseModel):
    time_range_hours: int
    execution_count: OverviewMetric
    mean_latency_ms: OverviewMetric
    total_execution_time_ms: OverviewMetric
    active_queries: OverviewMetric
    recent_regressions: list[dict[str, object]] = Field(default_factory=list)
    slowest_queries: list[QuerySummary] = Field(default_factory=list)
    data_freshness: datetime | None
    limitations: list[str]
