from dataclasses import dataclass, field
from decimal import Decimal
from typing import Any, Iterable


@dataclass
class PlanNode:
    id: str
    node_type: str
    relation: str | None = None
    alias: str | None = None
    startup_cost: Decimal | None = None
    total_cost: Decimal | None = None
    estimated_rows: int | None = None
    actual_rows: int | None = None
    actual_time_ms: Decimal | None = None
    loops: int | None = None
    filter: str | None = None
    index_name: str | None = None
    children: list["PlanNode"] = field(default_factory=list)
    metadata: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "node_type": self.node_type,
            "relation": self.relation,
            "alias": self.alias,
            "startup_cost": float(self.startup_cost) if self.startup_cost is not None else None,
            "total_cost": float(self.total_cost) if self.total_cost is not None else None,
            "estimated_rows": self.estimated_rows,
            "actual_rows": self.actual_rows,
            "actual_time_ms": float(self.actual_time_ms) if self.actual_time_ms is not None else None,
            "loops": self.loops,
            "filter": self.filter,
            "index_name": self.index_name,
            "children": [child.to_dict() for child in self.children],
            "metadata": self.metadata,
        }


@dataclass(frozen=True)
class Finding:
    code: str
    severity: str
    title: str
    evidence: str
    recommendation: str
    node_id: str


def _decimal(value: Any) -> Decimal | None:
    return Decimal(str(value)) if value is not None else None


def parse_postgres_plan(payload: Any) -> PlanNode:
    if isinstance(payload, list) and payload:
        payload = payload[0]
    root = payload.get("Plan", payload) if isinstance(payload, dict) else None
    if not isinstance(root, dict) or "Node Type" not in root:
        raise ValueError("Invalid PostgreSQL JSON plan")

    def visit(node: dict[str, Any], path: str) -> PlanNode:
        ignored = {
            "Plans", "Node Type", "Relation Name", "Alias", "Startup Cost", "Total Cost",
            "Plan Rows", "Actual Rows", "Actual Total Time", "Actual Loops", "Filter", "Index Name",
        }
        return PlanNode(
            id=path,
            node_type=node["Node Type"],
            relation=node.get("Relation Name"),
            alias=node.get("Alias"),
            startup_cost=_decimal(node.get("Startup Cost")),
            total_cost=_decimal(node.get("Total Cost")),
            estimated_rows=node.get("Plan Rows"),
            actual_rows=node.get("Actual Rows"),
            actual_time_ms=_decimal(node.get("Actual Total Time")),
            loops=node.get("Actual Loops"),
            filter=node.get("Filter"),
            index_name=node.get("Index Name"),
            children=[visit(child, f"{path}.{index}") for index, child in enumerate(node.get("Plans", []))],
            metadata={key: value for key, value in node.items() if key not in ignored},
        )

    return visit(root, "0")


def walk_plan(node: PlanNode) -> Iterable[PlanNode]:
    yield node
    for child in node.children:
        yield from walk_plan(child)


def analyze_plan(root: PlanNode) -> list[Finding]:
    findings: list[Finding] = []
    for node in walk_plan(root):
        node_type = node.node_type.lower()
        rows = node.actual_rows if node.actual_rows is not None else node.estimated_rows or 0
        if "seq scan" in node_type and rows >= 10_000:
            findings.append(
                Finding(
                    code="large_sequential_scan",
                    severity="high" if rows >= 1_000_000 else "medium",
                    title="Large sequential scan",
                    evidence=f"{node.node_type} reads approximately {rows:,} rows from {node.relation or 'a relation'}.",
                    recommendation="Review filter selectivity and evaluate an index after measuring write and storage cost.",
                    node_id=node.id,
                )
            )
        if "nested loop" in node_type and rows >= 100_000:
            findings.append(
                Finding(
                    code="high_cardinality_nested_loop",
                    severity="medium",
                    title="High-cardinality nested loop",
                    evidence=f"The nested loop produces approximately {rows:,} rows.",
                    recommendation="Check join estimates and indexes on the inner relation; compare alternative join plans.",
                    node_id=node.id,
                )
            )
        if node.actual_rows is not None and node.estimated_rows and node.estimated_rows > 0:
            ratio = max(node.actual_rows / node.estimated_rows, node.estimated_rows / max(node.actual_rows, 1))
            if ratio >= 10:
                findings.append(
                    Finding(
                        code="cardinality_misestimation",
                        severity="medium",
                        title="Cardinality estimate is inaccurate",
                        evidence=f"Estimated {node.estimated_rows:,} rows but observed {node.actual_rows:,} ({ratio:.1f}× difference).",
                        recommendation="Refresh statistics and inspect correlated predicates or data skew.",
                        node_id=node.id,
                    )
                )
        if "sort" in node_type and node.metadata.get("Sort Method") == "external merge":
            findings.append(
                Finding(
                    code="disk_sort",
                    severity="medium",
                    title="Sort spilled to disk",
                    evidence=f"External merge sort used {node.metadata.get('Sort Space Used', 'unknown')} kB.",
                    recommendation="Reduce rows before sorting or review work_mem in an isolated benchmark.",
                    node_id=node.id,
                )
            )
    return findings
