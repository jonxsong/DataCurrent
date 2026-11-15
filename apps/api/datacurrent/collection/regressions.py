from dataclasses import dataclass
from decimal import Decimal


@dataclass(frozen=True)
class Regression:
    query_id: str
    baseline_ms: Decimal
    recent_ms: Decimal
    ratio: Decimal
    confidence: str


def detect_regression(
    query_id: str,
    baseline_samples: list[Decimal],
    recent_samples: list[Decimal],
    *,
    minimum_ratio: Decimal = Decimal("1.5"),
) -> Regression | None:
    if len(baseline_samples) < 5 or len(recent_samples) < 3:
        return None
    baseline = sum(baseline_samples) / len(baseline_samples)
    recent = sum(recent_samples) / len(recent_samples)
    if baseline <= 0 or recent / baseline < minimum_ratio:
        return None
    ratio = recent / baseline
    return Regression(
        query_id=query_id,
        baseline_ms=baseline,
        recent_ms=recent,
        ratio=ratio,
        confidence="high" if len(baseline_samples) >= 20 and len(recent_samples) >= 10 else "medium",
    )
