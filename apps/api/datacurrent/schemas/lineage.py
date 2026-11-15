import uuid
from typing import Any

from pydantic import BaseModel


class LineageNodeResponse(BaseModel):
    id: uuid.UUID
    label: str
    kind: str
    metadata: dict[str, Any]


class LineageEdgeResponse(BaseModel):
    id: uuid.UUID
    source: uuid.UUID
    target: uuid.UUID
    relationship: str
    evidence_kind: str
    evidence: dict[str, Any]


class LineageGraphResponse(BaseModel):
    nodes: list[LineageNodeResponse]
    edges: list[LineageEdgeResponse]


class LineageSyncResponse(BaseModel):
    objects_synced: int
    dependencies_synced: int
