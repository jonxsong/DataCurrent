import uuid

from datacurrent.api.dependencies import require_role, workspace_membership
from datacurrent.core.config import Settings, get_settings
from datacurrent.core.database import get_db
from datacurrent.models.entities import Workspace, WorkspaceMembership, WorkspaceRole
from datacurrent.schemas.workspaces import (
    WorkspaceMemberResponse,
    WorkspaceSettingsResponse,
    WorkspaceSettingsUpdate,
)
from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(prefix="/workspaces/{workspace_id}", tags=["workspaces"])


async def settings_payload(
    workspace_id: uuid.UUID,
    membership: WorkspaceMembership,
    db: AsyncSession,
    settings: Settings,
) -> WorkspaceSettingsResponse:
    workspace = await db.get(Workspace, workspace_id)
    member_count = await db.scalar(
        select(func.count(WorkspaceMembership.id)).where(
            WorkspaceMembership.workspace_id == workspace_id
        )
    )
    return WorkspaceSettingsResponse(
        id=workspace.id,
        name=workspace.name,
        slug=workspace.slug,
        role=membership.role,
        retention_days=workspace.retention_days,
        member_count=member_count or 0,
        ai_configured=settings.openai_api_key is not None,
        encryption_configured=settings.datacurrent_encryption_key is not None,
    )


@router.get("", response_model=WorkspaceSettingsResponse)
async def get_workspace(
    workspace_id: uuid.UUID,
    membership: WorkspaceMembership = Depends(workspace_membership),
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> WorkspaceSettingsResponse:
    return await settings_payload(workspace_id, membership, db, settings)


@router.patch("", response_model=WorkspaceSettingsResponse)
async def update_workspace(
    workspace_id: uuid.UUID,
    payload: WorkspaceSettingsUpdate,
    membership: WorkspaceMembership = Depends(require_role(WorkspaceRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> WorkspaceSettingsResponse:
    workspace = await db.get(Workspace, workspace_id)
    workspace.retention_days = payload.retention_days
    await db.commit()
    return await settings_payload(workspace_id, membership, db, settings)


@router.get("/members", response_model=list[WorkspaceMemberResponse])
async def list_members(
    workspace_id: uuid.UUID,
    _membership: WorkspaceMembership = Depends(workspace_membership),
    db: AsyncSession = Depends(get_db),
) -> list[WorkspaceMemberResponse]:
    memberships = list(
        (
            await db.scalars(
                select(WorkspaceMembership)
                .where(WorkspaceMembership.workspace_id == workspace_id)
                .order_by(WorkspaceMembership.created_at)
            )
        ).all()
    )
    return [
        WorkspaceMemberResponse(
            id=item.user.id,
            email=item.user.email,
            display_name=item.user.display_name,
            role=item.role,
            joined_at=item.created_at,
        )
        for item in memberships
    ]
