from decimal import Decimal

from datacurrent.verification.benchmark import digest_rows, percentile


def test_result_digest_preserves_duplicates() -> None:
    assert digest_rows([(1,), (1,), (2,)], ordered=False) != digest_rows([(1,), (2,)], ordered=False)


def test_result_digest_respects_nulls_and_decimal_values() -> None:
    assert digest_rows([(None, Decimal("1.00"))], ordered=False) == digest_rows(
        [(None, Decimal("1.00"))], ordered=False
    )


def test_p95_uses_nearest_rank() -> None:
    assert percentile([1, 2, 3, 4, 100], 0.95) == 100
