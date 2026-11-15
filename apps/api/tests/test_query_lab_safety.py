import psycopg
import pytest
from datacurrent.analysis.sql import assert_read_only_select, parse_query
from datacurrent.core.errors import DataCurrentError
from datacurrent.models.entities import DatabaseProvider
from datacurrent.services import query_lab


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
    with pytest.raises(DataCurrentError):
        assert_read_only_select(parse_query(sql))


@pytest.mark.asyncio
async def test_query_lab_returns_safe_error_for_invalid_database_query(monkeypatch) -> None:
    async def reject_query(_config: dict[str, object], _sql: str):
        raise psycopg.ProgrammingError("relation customer_typo does not exist")

    monkeypatch.setattr(query_lab, "explain_postgresql", reject_query)

    with pytest.raises(DataCurrentError) as caught:
        await query_lab.explain_query(
            DatabaseProvider.POSTGRESQL,
            {},
            "SELECT * FROM customer_typo",
        )

    assert caught.value.code == "query_explain_failed"
    assert caught.value.status_code == 422
    assert "customer_typo" not in caught.value.message
