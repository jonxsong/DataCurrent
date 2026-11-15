from fastapi import APIRouter

from datacurrent.api.auth import router as auth_router
from datacurrent.api.connections import router as connections_router
from datacurrent.api.health import router as health_router
from datacurrent.api.overview import router as overview_router
from datacurrent.api.queries import router as queries_router
from datacurrent.api.query_lab import router as query_lab_router
from datacurrent.api.investigations import router as investigations_router
from datacurrent.api.benchmarks import router as benchmarks_router
from datacurrent.api.lineage import router as lineage_router


api_router = APIRouter()
api_router.include_router(health_router)
api_router.include_router(auth_router)
api_router.include_router(connections_router)
api_router.include_router(overview_router)
api_router.include_router(queries_router)
api_router.include_router(query_lab_router)
api_router.include_router(investigations_router)
api_router.include_router(benchmarks_router)
api_router.include_router(lineage_router)
