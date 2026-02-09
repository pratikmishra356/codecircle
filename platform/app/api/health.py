"""Health check endpoints."""

from fastapi import APIRouter

from app.schemas.workspace import PlatformHealth
from app.services.health import check_all

router = APIRouter()


@router.get("/health", response_model=PlatformHealth)
async def health():
    return await check_all()
