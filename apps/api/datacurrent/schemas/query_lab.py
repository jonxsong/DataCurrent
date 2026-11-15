import uuid
from typing import Any

from pydantic import BaseModel, Field


class AnalyzeQueryRequest(BaseModel):
    connection_id: uuid.UUID
    sql: str = Field(min_length=1, max_length=200_000)


class FindingResponse(BaseModel):
    code: str
    severity: str
    title: str
    evidence: str
    recommendation: str
    node_id: str


class AnalyzeQueryResponse(BaseModel):
    plan_id: uuid.UUID
    provider: str
    parsed_query: dict[str, Any]
    plan: dict[str, Any]
    findings: list[FindingResponse]
    safety: dict[str, object]
