from decimal import Decimal

from datacurrent.collection.regressions import detect_regression


def test_detects_latency_regression() -> None:
    result = detect_regression(
        "query-1",
        [Decimal("10")] * 8,
        [Decimal("22")] * 4,
    )
    assert result is not None
    assert result.ratio == Decimal("2.2")


def test_requires_enough_evidence() -> None:
    assert detect_regression("query-1", [Decimal("10")], [Decimal("30")]) is None
