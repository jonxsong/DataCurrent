import uuid
from datetime import datetime

from datacurrent.ai.investigator import InvestigationReport
from pydantic import BaseModel, ConfigDict, Field


class InvestigationRequest(BaseModel):
    question: str = Field(min_length=3, max_length=2_000)
    query_id: uuid.UUID | None = None
    plan_id: uuid.UUID | None = None


class InvestigationResponse(BaseModel):
    investigation_id: uuid.UUID
    report: InvestigationReport


class InvestigationSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    query_id: uuid.UUID | None
    plan_id: uuid.UUID | None
    title: str
    status: str
    summary: str | None
    created_at: datetime
