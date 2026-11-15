from typing import Any

from fastapi import Request
from fastapi.responses import JSONResponse


class DataCurrentError(Exception):
    def __init__(self, message: str, *, code: str = "datacurrent_error", status_code: int = 400):
        super().__init__(message)
        self.message = message
        self.code = code
        self.status_code = status_code


async def datacurrent_error_handler(_request: Request, exc: DataCurrentError) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": {"code": exc.code, "message": exc.message}},
    )


def error_payload(code: str, message: str, details: Any | None = None) -> dict[str, Any]:
    payload: dict[str, Any] = {"error": {"code": code, "message": message}}
    if details is not None:
        payload["error"]["details"] = details
    return payload
