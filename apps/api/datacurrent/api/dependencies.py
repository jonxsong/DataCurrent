import uuid
from collections.abc import Callable

from fastapi import Cookie, Depends, Header
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from datacurrent.core.database import get_db
from datacurrent.core.errors import DataCurrentError
from datacurrent.core.security import decode_access_token
from datacurrent.models.entities import User, WorkspaceMembership, WorkspaceRole


bearer = HTTPBearer(auto_error=False)


async def current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
    session_token: str | None = Cookie(default=None, alias="dc_session"),
    db: AsyncSession = Depends(get_db),
) -> User:
    token = credentials.credentials if credentials else session_token
    if not token:
        raise DataCurrentError("Authentication required", code="authentication_required", status_code=401)
    user_id = decode_access_token(token)
    user = await db.scalar(select(User).where(User.id == user_id, User.is_active.is_(True)))
    if not user:
        raise DataCurrentError("User not found", code="invalid_session", status_code=401)
    return user


async def workspace_membership(
    workspace_id: uuid.UUID,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> WorkspaceMembership:
    membership = await db.scalar(
        select(WorkspaceMembership).where(
            WorkspaceMembership.workspace_id == workspace_id,
            WorkspaceMembership.user_id == user.id,
        )
    )
    if not membership:
        raise DataCurrentError("Workspace not found", code="workspace_not_found", status_code=404)
    return membership


ROLE_WEIGHT = {
    WorkspaceRole.VIEWER: 0,
    WorkspaceRole.MEMBER: 1,
    WorkspaceRole.ADMIN: 2,
    WorkspaceRole.OWNER: 3,
}


def require_role(minimum: WorkspaceRole) -> Callable[..., WorkspaceMembership]:
    async def dependency(
        membership: WorkspaceMembership = Depends(workspace_membership),
    ) -> WorkspaceMembership:
        if ROLE_WEIGHT[membership.role] < ROLE_WEIGHT[minimum]:
            raise DataCurrentError("Insufficient workspace role", code="forbidden", status_code=403)
        return membership

    return dependency


def request_ip(x_forwarded_for: str | None = Header(default=None)) -> str | None:
    return x_forwarded_for.split(",", 1)[0].strip() if x_forwarded_for else None
