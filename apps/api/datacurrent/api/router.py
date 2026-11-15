from fastapi import APIRouter

from datacurrent.api.auth import router as auth_router
from datacurrent.api.health import router as health_router


api_router = APIRouter()
api_router.include_router(health_router)
api_router.include_router(auth_router)
