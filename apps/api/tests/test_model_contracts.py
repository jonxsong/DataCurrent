from datacurrent.models.entities import DatabaseConnection


def test_connection_status_default_matches_native_postgres_enum() -> None:
    default = DatabaseConnection.__table__.c.status.server_default
    assert default is not None
    assert str(default.arg) == "PENDING"
