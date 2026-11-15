import pytest
from datacurrent.connectors.network import validate_database_host
from datacurrent.schemas.connections import PostgreSQLConfig


@pytest.mark.asyncio
async def test_localhost_allowlist_for_demo() -> None:
    await validate_database_host("localhost", 5432)


def test_postgres_allows_explicit_non_tls_mode_for_controlled_local_sources() -> None:
    config = PostgreSQLConfig(
        provider="postgresql",
        host="demo-postgres",
        database="commerce",
        username="demo_reader",
        password="demo_reader",  # noqa: S106 - public disposable demo credential
        ssl_mode="disable",
    )
    assert config.ssl_mode == "disable"
