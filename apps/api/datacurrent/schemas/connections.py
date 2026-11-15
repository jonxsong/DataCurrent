import uuid
from datetime import datetime
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, SecretStr

from datacurrent.models.entities import ConnectionStatus, DatabaseProvider


class PostgreSQLConfig(BaseModel):
    provider: Literal[DatabaseProvider.POSTGRESQL]
    host: str = Field(min_length=1, max_length=253)
    port: int = Field(default=5432, ge=1, le=65535)
    database: str = Field(min_length=1, max_length=128)
    username: str = Field(min_length=1, max_length=128)
    password: SecretStr
    ssl_mode: Literal["verify-full", "verify-ca", "require"] = "verify-full"


class SnowflakeConfig(BaseModel):
    provider: Literal[DatabaseProvider.SNOWFLAKE]
    account: str = Field(min_length=2, max_length=255)
    username: str = Field(min_length=1, max_length=255)
    password: SecretStr
    warehouse: str | None = Field(default=None, max_length=255)
    database: str | None = Field(default=None, max_length=255)
    schema_name: str | None = Field(default=None, alias="schema", max_length=255)
    role: str | None = Field(default=None, max_length=255)


ConnectionConfig = Annotated[PostgreSQLConfig | SnowflakeConfig, Field(discriminator="provider")]


class ConnectionCreate(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    config: ConnectionConfig
    benchmark_only: bool = False


class ConnectionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    name: str
    provider: DatabaseProvider
    status: ConnectionStatus
    capabilities: dict[str, object]
    tls_verify: bool
    collect_enabled: bool
    benchmark_only: bool
    last_checked_at: datetime | None
    last_collected_at: datetime | None
    last_error_code: str | None


class ConnectionTestResponse(BaseModel):
    ok: bool
    latency_ms: float
    server_version: str | None
    capabilities: dict[str, object]
    guidance: list[str]
