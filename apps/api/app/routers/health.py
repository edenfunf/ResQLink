"""Health check endpoint."""
from __future__ import annotations

from fastapi import APIRouter

from app.core.config import settings

router = APIRouter(prefix="/v1", tags=["health"])


@router.get("/health", summary="Service health check")
def health() -> dict:
    return {
        "status": "ok",
        "service": "disasterblock-api",
        "version": settings.APP_VERSION,
    }
