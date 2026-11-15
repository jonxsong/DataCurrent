import uuid

from datacurrent.models.entities import WorkspaceRole
from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


class AuthConfigResponse(BaseModel):
    registration_enabled: bool


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=12, max_length=128)
    display_name: str = Field(min_length=2, max_length=120)
    workspace_name: str = Field(min_length=2, max_length=120)

    @field_validator("password")
    @classmethod
    def validate_password_strength(cls, value: str) -> str:
        classes = [
            any(c.islower() for c in value),
            any(c.isupper() for c in value),
            any(c.isdigit() for c in value),
        ]
        if sum(classes) < 2:
            raise ValueError("Password must contain at least two character classes")
        return value


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    email: EmailStr
    display_name: str


class WorkspaceResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    name: str
    slug: str
    role: WorkspaceRole


class SessionResponse(BaseModel):
    user: UserResponse
    workspaces: list[WorkspaceResponse]
