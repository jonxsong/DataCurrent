from typing import Any

from datacurrent.connectors.base import DatabaseConnector
from datacurrent.connectors.postgresql import PostgreSQLConnector
from datacurrent.connectors.snowflake import SnowflakeConnector
from datacurrent.models.entities import DatabaseProvider


def connector_for(provider: DatabaseProvider, config: dict[str, Any]) -> DatabaseConnector:
    if provider is DatabaseProvider.POSTGRESQL:
        return PostgreSQLConnector(config)
    if provider is DatabaseProvider.SNOWFLAKE:
        return SnowflakeConnector(config)
    raise ValueError(f"Unsupported database provider: {provider}")
