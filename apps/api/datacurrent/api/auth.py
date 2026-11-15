import re
import uuid

from datacurrent.api.dependencies import current_user
from datacurrent.core.config import Settings, get_settings
from datacurrent.core.database import get_db
from datacurrent.core.errors import DataCurrentError
from datacurrent.core.security import create_access_token, hash_password, verify_password
from datacurrent.models.entities import User, Workspace, WorkspaceMembership, WorkspaceRole
from datacurrent.schemas.auth import (
    AuthConfigResponse,
    LoginRequest,
    RegisterRequest,
    SessionResponse,
    UserResponse,
    WorkspaceResponse,
)
from fastapi import APIRouter, Depends, Response
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(prefix="/auth", tags=["authentication"])


def slugify(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")[:65]
    return f"{slug}-{uuid.uuid4().hex[:8]}"


def set_session_cookie(response: Response, token: str, settings: Settings) -> None:
    response.set_cookie(
        "dc_session",
        token,
        httponly=True,
        secure=settings.is_production,
        samesite="lax",
        max_age=1800,
        path="/",
    )


def require_registration_enabled(settings: Settings) -> None:
    if not settings.datacurrent_allow_registration:
        raise DataCurrentError(
            "Public registration is disabled for this deployment.",
            code="registration_disabled",
            status_code=403,
        )


async def session_payload(user: User, db: AsyncSession) -> SessionResponse:
    memberships = (
        await db.scalars(select(WorkspaceMembership).where(WorkspaceMembership.user_id == user.id))
    ).all()
    return SessionResponse(
        user=UserResponse.model_validate(user),
        workspaces=[
            WorkspaceResponse(
                id=membership.workspace.id,
                name=membership.workspace.name,
                slug=membership.workspace.slug,
                role=membership.role,
            )
            for membership in memberships
        ],
    )


@router.post("/register", response_model=SessionResponse, status_code=201)
async def register(
    payload: RegisterRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> SessionResponse:
    require_registration_enabled(settings)
    user = User(
        email=payload.email.lower(),
        password_hash=hash_password(payload.password),
        display_name=payload.display_name.strip(),
    )
    workspace = Workspace(name=payload.workspace_name.strip(), slug=slugify(payload.workspace_name))
    db.add_all([user, workspace])
    try:
        await db.flush()
        membership = WorkspaceMembership(
            workspace_id=workspace.id, user_id=user.id, role=WorkspaceRole.OWNER
        )
        db.add(membership)
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise DataCurrentError(
            "Email is already registered", code="email_exists", status_code=409
        ) from exc
    token = create_access_token(user.id)
    set_session_cookie(response, token, settings)
    return await session_payload(user, db)


@router.get("/config", response_model=AuthConfigResponse)
async def auth_config(settings: Settings = Depends(get_settings)) -> AuthConfigResponse:
    return AuthConfigResponse(registration_enabled=settings.datacurrent_allow_registration)


@router.post("/login", response_model=SessionResponse)
async def login(
    payload: LoginRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> SessionResponse:
    user = await db.scalar(select(User).where(User.email == payload.email.lower()))
    if not user or not user.is_active or not verify_password(payload.password, user.password_hash):
        raise DataCurrentError(
            "Invalid email or password", code="invalid_credentials", status_code=401
        )
    token = create_access_token(user.id)
    set_session_cookie(response, token, settings)
    return await session_payload(user, db)


@router.post("/logout", status_code=204)
async def logout(response: Response) -> None:
    response.delete_cookie("dc_session", path="/")


@router.get("/session", response_model=SessionResponse)
async def get_session(
    user: User = Depends(current_user), db: AsyncSession = Depends(get_db)
) -> SessionResponse:
    return await session_payload(user, db)
