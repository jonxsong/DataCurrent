from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any


@dataclass(frozen=True)
class ConnectionTestResult:
    ok: bool
    latency_ms: float
    server_version: str | None = None
    capabilities: dict[str, Any] = field(default_factory=dict)
    guidance: list[str] = field(default_factory=list)


@dataclass(frozen=True)
class DiscoveredObject:
    external_id: str
    schema_name: str
    name: str
    kind: str
    metadata: dict[str, Any] = field(default_factory=dict)


class DatabaseConnector(ABC):
    @abstractmethod
    async def test(self) -> ConnectionTestResult: ...

    @abstractmethod
    async def discover(self) -> list[DiscoveredObject]: ...
