import pytest
from datacurrent.analysis.sql import assert_read_only_select, parse_query
from datacurrent.core.errors import DataCurrentError


def test_query_fingerprint_redacts_literals() -> None:
    first = parse_query("SELECT * FROM orders WHERE customer_id = 42")
    second = parse_query("SELECT * FROM orders WHERE customer_id = 9001")
    assert first.fingerprint == second.fingerprint
    assert first.referenced_tables == ("orders",)


def test_rejects_multiple_statements() -> None:
    with pytest.raises(DataCurrentError):
        parse_query("SELECT 1; SELECT 2")


def test_rejects_mutating_statement() -> None:
    parsed = parse_query("DELETE FROM orders")
    with pytest.raises(DataCurrentError):
        assert_read_only_select(parsed)
