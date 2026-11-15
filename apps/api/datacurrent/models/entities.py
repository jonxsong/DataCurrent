import enum
import uuid
from datetime import datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import (
    BigInteger,
    Boolean,
    CheckConstraint,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Integer,
    LargeBinary,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import ARRAY, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from datacurrent.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class WorkspaceRole(enum.StrEnum):
    OWNER = "owner"
    ADMIN = "admin"
    MEMBER = "member"
    VIEWER = "viewer"


class DatabaseProvider(enum.StrEnum):
    POSTGRESQL = "postgresql"
    SNOWFLAKE = "snowflake"


class ConnectionStatus(enum.StrEnum):
    PENDING = "pending"
    HEALTHY = "healthy"
    DEGRADED = "degraded"
    UNREACHABLE = "unreachable"
    DISABLED = "disabled"


class EvidenceKind(enum.StrEnum):
    OBSERVED = "observed"
    HEURISTIC = "heuristic"
    HYPOTHESIS = "hypothesis"


class User(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "users"

    email: Mapped[str] = mapped_column(String(320), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    display_name: Mapped[str] = mapped_column(String(120))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class Workspace(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "workspaces"

    name: Mapped[str] = mapped_column(String(120))
    slug: Mapped[str] = mapped_column(String(80), unique=True, index=True)
    retention_days: Mapped[int] = mapped_column(Integer, default=30, server_default="30")

    __table_args__ = (CheckConstraint("retention_days BETWEEN 1 AND 3650", name="retention_days"),)


class WorkspaceMembership(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "workspace_memberships"

    workspace_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("workspaces.id", ondelete="CASCADE"), index=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    role: Mapped[WorkspaceRole] = mapped_column(Enum(WorkspaceRole, name="workspace_role"))

    workspace: Mapped[Workspace] = relationship(lazy="joined")
    user: Mapped[User] = relationship(lazy="joined")

    __table_args__ = (UniqueConstraint("workspace_id", "user_id"),)


class DatabaseConnection(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "database_connections"

    workspace_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("workspaces.id", ondelete="CASCADE"), index=True
    )
    name: Mapped[str] = mapped_column(String(120))
    provider: Mapped[DatabaseProvider] = mapped_column(
        Enum(DatabaseProvider, name="database_provider")
    )
    status: Mapped[ConnectionStatus] = mapped_column(
        Enum(ConnectionStatus, name="connection_status"),
        default=ConnectionStatus.PENDING,
        server_default=ConnectionStatus.PENDING.value,
    )
    encrypted_config: Mapped[bytes] = mapped_column(LargeBinary)
    config_fingerprint: Mapped[str] = mapped_column(String(64))
    capabilities: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict, server_default="{}")
    tls_verify: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")
    collect_enabled: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")
    benchmark_only: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    last_checked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_collected_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_error_code: Mapped[str | None] = mapped_column(String(80))

    __table_args__ = (UniqueConstraint("workspace_id", "name"),)


class CatalogSchema(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "catalog_schemas"

    connection_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("database_connections.id", ondelete="CASCADE"), index=True
    )
    external_id: Mapped[str] = mapped_column(String(255))
    name: Mapped[str] = mapped_column(String(255))

    __table_args__ = (UniqueConstraint("connection_id", "external_id"),)


class CatalogTable(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "catalog_tables"

    schema_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("catalog_schemas.id", ondelete="CASCADE"), index=True
    )
    external_id: Mapped[str] = mapped_column(String(255))
    name: Mapped[str] = mapped_column(String(255))
    kind: Mapped[str] = mapped_column(String(40), default="table", server_default="table")
    estimated_rows: Mapped[int | None] = mapped_column(BigInteger)
    size_bytes: Mapped[int | None] = mapped_column(BigInteger)
    comment: Mapped[str | None] = mapped_column(Text)
    statistics: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict, server_default="{}")

    __table_args__ = (UniqueConstraint("schema_id", "external_id"),)


class CatalogColumn(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "catalog_columns"

    table_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("catalog_tables.id", ondelete="CASCADE"), index=True
    )
    name: Mapped[str] = mapped_column(String(255))
    ordinal_position: Mapped[int] = mapped_column(Integer)
    data_type: Mapped[str] = mapped_column(String(255))
    nullable: Mapped[bool] = mapped_column(Boolean)
    default_expression: Mapped[str | None] = mapped_column(Text)
    is_primary_key: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")

    __table_args__ = (
        UniqueConstraint("table_id", "name"),
        CheckConstraint("ordinal_position > 0", name="positive_ordinal"),
    )


class CatalogIndex(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "catalog_indexes"

    table_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("catalog_tables.id", ondelete="CASCADE"), index=True
    )
    name: Mapped[str] = mapped_column(String(255))
    definition: Mapped[str] = mapped_column(Text)
    column_names: Mapped[list[str]] = mapped_column(ARRAY(String(255)))
    is_unique: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    is_primary: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    size_bytes: Mapped[int | None] = mapped_column(BigInteger)
    scan_count: Mapped[int | None] = mapped_column(BigInteger)

    __table_args__ = (UniqueConstraint("table_id", "name"),)


class QueryFingerprint(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "query_fingerprints"

    connection_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("database_connections.id", ondelete="CASCADE"), index=True
    )
    provider_query_id: Mapped[str | None] = mapped_column(String(255))
    fingerprint_hash: Mapped[str] = mapped_column(String(64))
    normalized_sql: Mapped[str] = mapped_column(Text)
    operation: Mapped[str | None] = mapped_column(String(32))
    referenced_objects: Mapped[list[str]] = mapped_column(
        ARRAY(String(512)), default=list, server_default="{}"
    )
    first_seen_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    last_seen_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), index=True
    )

    __table_args__ = (UniqueConstraint("connection_id", "fingerprint_hash"),)


class QueryMetricSnapshot(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "query_metric_snapshots"

    workspace_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("workspaces.id", ondelete="CASCADE"), index=True
    )
    query_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("query_fingerprints.id", ondelete="CASCADE"), index=True
    )
    captured_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), index=True
    )
    interval_seconds: Mapped[int] = mapped_column(Integer)
    calls: Mapped[int] = mapped_column(BigInteger)
    total_time_ms: Mapped[Decimal] = mapped_column(Numeric(20, 3))
    mean_time_ms: Mapped[Decimal] = mapped_column(Numeric(20, 3))
    rows_processed: Mapped[int] = mapped_column(BigInteger)
    shared_blocks_read: Mapped[int | None] = mapped_column(BigInteger)
    source_reset_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    is_cumulative: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")

    __table_args__ = (
        CheckConstraint("interval_seconds > 0", name="positive_interval"),
        Index("ix_query_metrics_query_captured", "query_id", "captured_at"),
    )


class ExecutionPlan(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "execution_plans"

    workspace_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("workspaces.id", ondelete="CASCADE"), index=True
    )
    query_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("query_fingerprints.id", ondelete="SET NULL"), index=True
    )
    provider: Mapped[DatabaseProvider] = mapped_column(Enum(DatabaseProvider, name="plan_provider"))
    plan_json: Mapped[dict[str, Any]] = mapped_column(JSONB)
    planning_time_ms: Mapped[Decimal | None] = mapped_column(Numeric(20, 3))
    execution_time_ms: Mapped[Decimal | None] = mapped_column(Numeric(20, 3))
    analyzed: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    heuristics: Mapped[list[dict[str, Any]]] = mapped_column(
        JSONB, default=list, server_default="[]"
    )


class Investigation(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "investigations"

    workspace_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("workspaces.id", ondelete="CASCADE"), index=True
    )
    created_by_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"))
    query_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("query_fingerprints.id", ondelete="SET NULL")
    )
    plan_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("execution_plans.id", ondelete="SET NULL")
    )
    title: Mapped[str] = mapped_column(String(240))
    status: Mapped[str] = mapped_column(String(32), default="open", server_default="open")
    question: Mapped[str | None] = mapped_column(Text)
    summary: Mapped[str | None] = mapped_column(Text)
    evidence_refs: Mapped[list[dict[str, Any]]] = mapped_column(
        JSONB, default=list, server_default="[]"
    )


class OptimizationRecommendation(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "optimization_recommendations"

    investigation_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("investigations.id", ondelete="CASCADE"), index=True
    )
    finding: Mapped[str] = mapped_column(Text)
    evidence: Mapped[list[dict[str, Any]]] = mapped_column(JSONB)
    recommendation: Mapped[str] = mapped_column(Text)
    proposed_sql: Mapped[str | None] = mapped_column(Text)
    tradeoffs: Mapped[list[str]] = mapped_column(ARRAY(Text))
    confidence: Mapped[str] = mapped_column(String(16))
    evidence_kind: Mapped[EvidenceKind] = mapped_column(Enum(EvidenceKind, name="evidence_kind"))
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    __table_args__ = (
        CheckConstraint("confidence IN ('low', 'medium', 'high')", name="confidence"),
    )


class BenchmarkRun(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "benchmark_runs"

    workspace_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("workspaces.id", ondelete="CASCADE"), index=True
    )
    recommendation_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("optimization_recommendations.id", ondelete="SET NULL")
    )
    connection_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("database_connections.id", ondelete="RESTRICT")
    )
    original_sql: Mapped[str] = mapped_column(Text)
    candidate_sql: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(32), default="queued", server_default="queued")
    warmup_iterations: Mapped[int] = mapped_column(Integer, default=2, server_default="2")
    measured_iterations: Mapped[int] = mapped_column(Integer, default=10, server_default="10")
    original_median_ms: Mapped[Decimal | None] = mapped_column(Numeric(20, 3))
    candidate_median_ms: Mapped[Decimal | None] = mapped_column(Numeric(20, 3))
    original_p95_ms: Mapped[Decimal | None] = mapped_column(Numeric(20, 3))
    candidate_p95_ms: Mapped[Decimal | None] = mapped_column(Numeric(20, 3))
    result_agreement: Mapped[str | None] = mapped_column(String(40))
    environment: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict, server_default="{}")
    methodology: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict, server_default="{}")
    raw_measurements: Mapped[dict[str, Any]] = mapped_column(
        JSONB, default=dict, server_default="{}"
    )

    __table_args__ = (
        CheckConstraint("warmup_iterations BETWEEN 0 AND 20", name="warmup_iterations"),
        CheckConstraint("measured_iterations BETWEEN 3 AND 100", name="measured_iterations"),
    )


class LineageNode(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "lineage_nodes"

    workspace_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("workspaces.id", ondelete="CASCADE"), index=True
    )
    connection_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("database_connections.id", ondelete="CASCADE")
    )
    catalog_table_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("catalog_tables.id", ondelete="CASCADE")
    )
    external_id: Mapped[str] = mapped_column(String(512))
    label: Mapped[str] = mapped_column(String(255))
    kind: Mapped[str] = mapped_column(String(40))
    metadata_json: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict, server_default="{}")

    __table_args__ = (UniqueConstraint("connection_id", "external_id", "kind"),)


class LineageEdge(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "lineage_edges"

    workspace_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("workspaces.id", ondelete="CASCADE"), index=True
    )
    source_node_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("lineage_nodes.id", ondelete="CASCADE"), index=True
    )
    target_node_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("lineage_nodes.id", ondelete="CASCADE"), index=True
    )
    relationship: Mapped[str] = mapped_column(String(40))
    evidence_kind: Mapped[EvidenceKind] = mapped_column(
        Enum(EvidenceKind, name="lineage_evidence_kind")
    )
    evidence: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict, server_default="{}")

    __table_args__ = (
        UniqueConstraint("source_node_id", "target_node_id", "relationship"),
        CheckConstraint("source_node_id <> target_node_id", name="not_self_edge"),
    )


class AuditEvent(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "audit_events"

    workspace_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("workspaces.id", ondelete="CASCADE"), index=True
    )
    actor_user_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )
    occurred_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), index=True
    )
    event_type: Mapped[str] = mapped_column(String(100))
    resource_type: Mapped[str] = mapped_column(String(80))
    resource_id: Mapped[str | None] = mapped_column(String(255))
    request_id: Mapped[str | None] = mapped_column(String(128))
    ip_hash: Mapped[str | None] = mapped_column(String(64))
    details: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict, server_default="{}")

    __table_args__ = (Index("ix_audit_workspace_occurred", "workspace_id", "occurred_at"),)
