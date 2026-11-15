from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

import structlog
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from datacurrent import __version__
from datacurrent.api.router import api_router
from datacurrent.core.config import get_settings
from datacurrent.core.database import engine
from datacurrent.core.errors import DataCurrentError, datacurrent_error_handler
from datacurrent.core.logging import configure_logging
from datacurrent.middleware import RequestContextMiddleware

settings = get_settings()
configure_logging(settings.datacurrent_log_level)
logger = structlog.get_logger(__name__)


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    await logger.ainfo("api.started", version=__version__, environment=settings.datacurrent_env)
    yield
    await engine.dispose()
    await logger.ainfo("api.stopped")


app = FastAPI(
    title="DataCurrent API",
    description="Evidence-backed PostgreSQL and Snowflake intelligence.",
    version=__version__,
    lifespan=lifespan,
    docs_url="/docs" if not settings.is_production else None,
    redoc_url=None,
)
app.add_middleware(RequestContextMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    allow_headers=["Authorization", "Content-Type", "X-Request-ID"],
)
app.add_exception_handler(DataCurrentError, datacurrent_error_handler)  # type: ignore[arg-type]
app.include_router(api_router, prefix="/api/v1")
