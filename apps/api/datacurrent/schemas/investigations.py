import uuid

from datacurrent.ai.investigator import InvestigationReport
from pydantic import BaseModel, Field


class InvestigationRequest(BaseModel):
    question: str = Field(min_length=3, max_length=2_000)
    query_id: uuid.UUID | None = None
    plan_id: uuid.UUID | None = None


class InvestigationResponse(BaseModel):
    investigation_id: uuid.UUID
    report: InvestigationReport
