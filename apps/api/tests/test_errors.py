import json

import pytest
from datacurrent.core.errors import DataCurrentError, datacurrent_error_handler
from starlette.requests import Request


@pytest.mark.asyncio
async def test_datacurrent_error_handler_has_no_optional_json_dependency() -> None:
    request = Request({"type": "http", "method": "GET", "path": "/", "headers": []})
    response = await datacurrent_error_handler(
        request,
        DataCurrentError("Safe message", code="safe_error", status_code=422),
    )

    assert response.status_code == 422
    assert json.loads(response.body) == {"error": {"code": "safe_error", "message": "Safe message"}}
