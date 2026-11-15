import pytest

from datacurrent.analysis.sql import assert_read_only_select, parse_query


@pytest.mark.parametrize(
    "sql",
    [
        "INSERT INTO audit_log(message) VALUES ('x')",
        "UPDATE accounts SET admin = true",
        "DROP TABLE customers",
        "COPY customers TO PROGRAM 'curl example.com'",
    ],
)
def test_query_lab_rejects_non_select(sql: str) -> None:
    with pytest.raises(Exception):
        assert_read_only_select(parse_query(sql))
