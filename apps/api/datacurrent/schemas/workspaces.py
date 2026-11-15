import uuid
from datetime import datetime

from datacurrent.models.entities import WorkspaceRole
from pydantic import BaseModel, EmailStr, Field


class WorkspaceSettingsResponse(BaseModel):
    id: uuid.UUID
    name: str
    slug: str
    role: WorkspaceRole
    retention_days: int
    member_count: int
    ai_configured: bool
    encryption_configured: bool


class WorkspaceSettingsUpdate(BaseModel):
    retention_days: int = Field(ge=1, le=3650)


class WorkspaceMemberResponse(BaseModel):
    id: uuid.UUID
    email: EmailStr
    display_name: str
    role: WorkspaceRole
    joined_at: datetime
