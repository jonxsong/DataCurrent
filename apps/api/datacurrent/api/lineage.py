import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from datacurrent.api.dependencies import require_role, workspace_membership
from datacurrent.core.database import get_db
from datacurrent.core.errors import DataCurrentError
from datacurrent.lineage import sync_catalog, sync_dependencies
from datacurrent.models.entities import (
    DatabaseConnection,
    LineageEdge,
    LineageNode,
    WorkspaceMembership,
    WorkspaceRole,
)
from datacurrent.schemas.lineage import (
    LineageEdgeResponse,
    LineageGraphResponse,
    LineageNodeResponse,
    LineageSyncResponse,
)


router = APIRouter(prefix="/workspaces/{workspace_id}/lineage", tags=["lineage"])


@router.post("/connections/{connection_id}/sync", response_model=LineageSyncResponse)
async def sync_lineage(
    workspace_id: uuid.UUID,
    connection_id: uuid.UUID,
    _membership: WorkspaceMembership = Depends(require_role(WorkspaceRole.MEMBER)),
    db: AsyncSession = Depends(get_db),
) -> LineageSyncResponse:
    connection = await db.scalar(
        select(DatabaseConnection).where(
            DatabaseConnection.id == connection_id,
            DatabaseConnection.workspace_id == workspace_id,
        )
    )
    if not connection:
        raise DataCurrentError("Connection not found", code="connection_not_found", status_code=404)
    objects = await sync_catalog(db, connection)
    dependencies = await sync_dependencies(db, connection)
    return LineageSyncResponse(objects_synced=objects, dependencies_synced=dependencies)


@router.get("/graph", response_model=LineageGraphResponse)
async def lineage_graph(
    workspace_id: uuid.UUID,
    connection_id: uuid.UUID | None = None,
    search: str | None = Query(default=None, max_length=120),
    _membership: WorkspaceMembership = Depends(workspace_membership),
    db: AsyncSession = Depends(get_db),
) -> LineageGraphResponse:
    node_query = select(LineageNode).where(LineageNode.workspace_id == workspace_id)
    if connection_id:
        node_query = node_query.where(LineageNode.connection_id == connection_id)
    if search:
        node_query = node_query.where(LineageNode.label.ilike(f"%{search}%"))
    nodes = list((await db.scalars(node_query.order_by(LineageNode.label).limit(1000))).all())
    node_ids = [node.id for node in nodes]
    edges = []
    if node_ids:
        edges = list(
            (
                await db.scalars(
                    select(LineageEdge).where(
                        LineageEdge.workspace_id == workspace_id,
                        or_(LineageEdge.source_node_id.in_(node_ids), LineageEdge.target_node_id.in_(node_ids)),
                    )
                )
            ).all()
        )
    return LineageGraphResponse(
        nodes=[
            LineageNodeResponse(id=node.id, label=node.label, kind=node.kind, metadata=node.metadata_json)
            for node in nodes
        ],
        edges=[
            LineageEdgeResponse(
                id=edge.id,
                source=edge.source_node_id,
                target=edge.target_node_id,
                relationship=edge.relationship,
                evidence_kind=edge.evidence_kind.value,
                evidence=edge.evidence,
            )
            for edge in edges
        ],
    )
