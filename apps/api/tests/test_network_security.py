import pytest

from datacurrent.connectors.network import validate_database_host


@pytest.mark.asyncio
async def test_localhost_allowlist_for_demo() -> None:
    await validate_database_host("localhost", 5432)
