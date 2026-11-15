from datacurrent.main import app
from fastapi.testclient import TestClient


def test_health_returns_ok() -> None:
    with TestClient(app) as client:
        response = client.get("/api/v1/healthz")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"
