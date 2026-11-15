import json
from datetime import UTC, datetime
from unittest.mock import MagicMock

import snowflake.connector
from datacurrent.collection.query_metrics import _collect_snowflake_sync
from datacurrent.connectors.snowflake import SnowflakeConnector
from datacurrent.services.query_lab import _explain_snowflake_sync


def snowflake_config() -> dict[str, str]:
    return {
        "account": "acme-production",
        "username": "DATACURRENT_SERVICE",
        "password": "test-only",  # noqa: S105
        "warehouse": "DATACURRENT_WH",
        "database": "ANALYTICS",
        "schema": "PUBLIC",
        "role": "DATACURRENT_MONITOR",
    }


def connection_with_cursor(cursor: MagicMock) -> MagicMock:
    cursor.__enter__.return_value = cursor
    connection = MagicMock()
    connection.__enter__.return_value = connection
    connection.cursor.return_value = cursor
    return connection


def test_snowflake_session_is_bounded_and_tagged(monkeypatch) -> None:
    connect = MagicMock(return_value=connection_with_cursor(MagicMock()))
    monkeypatch.setattr(snowflake.connector, "connect", connect)

    SnowflakeConnector(snowflake_config())._connect()

    connect.assert_called_once_with(
        account="acme-production",
        user="DATACURRENT_SERVICE",
        password="test-only",  # noqa: S106
        warehouse="DATACURRENT_WH",
        database="ANALYTICS",
        schema="PUBLIC",
        role="DATACURRENT_MONITOR",
        login_timeout=8,
        network_timeout=15,
        session_parameters={
            "QUERY_TAG": "datacurrent",
            "STATEMENT_TIMEOUT_IN_SECONDS": 15,
        },
    )


def test_snowflake_capability_probe(monkeypatch) -> None:
    cursor = MagicMock()
    cursor.fetchone.return_value = ("9.2.1", "AWS_US_WEST_2", "DATACURRENT_MONITOR")
    monkeypatch.setattr(
        snowflake.connector,
        "connect",
        MagicMock(return_value=connection_with_cursor(cursor)),
    )

    result = SnowflakeConnector(snowflake_config())._test_sync()

    assert result.ok is True
    assert result.server_version == "9.2.1"
    assert result.capabilities["query_history"] is True
    assert result.capabilities["region"] == "AWS_US_WEST_2"
    cursor.execute.assert_called_once_with(
        "SELECT CURRENT_VERSION(), CURRENT_REGION(), CURRENT_ROLE()"
    )


def test_snowflake_account_usage_collection(monkeypatch) -> None:
    cursor = MagicMock()
    now = datetime.now(UTC)
    cursor.fetchall.return_value = [("query-123", "SELECT COUNT(*) FROM EVENTS", 84, 12, now, now)]
    monkeypatch.setattr(
        SnowflakeConnector,
        "_connect",
        lambda _self: connection_with_cursor(cursor),
    )

    metrics = _collect_snowflake_sync(snowflake_config())

    assert len(metrics) == 1
    assert metrics[0].provider_query_id == "query-123"
    assert metrics[0].is_cumulative is False
    assert "SNOWFLAKE.ACCOUNT_USAGE.QUERY_HISTORY" in cursor.execute.call_args.args[0]


def test_snowflake_query_lab_requests_json_plan(monkeypatch) -> None:
    cursor = MagicMock()
    cursor.fetchone.return_value = (json.dumps({"GlobalStats": {"partitionsTotal": 8}}),)
    monkeypatch.setattr(
        SnowflakeConnector,
        "_connect",
        lambda _self: connection_with_cursor(cursor),
    )

    plan = _explain_snowflake_sync(snowflake_config(), "SELECT * FROM EVENTS")

    assert plan["GlobalStats"]["partitionsTotal"] == 8
    cursor.execute.assert_called_once_with("EXPLAIN USING JSON SELECT * FROM EVENTS")
