"""Cross-incident overview endpoint for the console dashboard."""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.schemas.overview import OverviewResponse
from app.services import overview_service

router = APIRouter(prefix="/v1", tags=["overview"])


@router.get("/overview", response_model=OverviewResponse, summary="Cross-incident KPIs")
def get_overview(db: Session = Depends(get_db)) -> OverviewResponse:
    return OverviewResponse(**overview_service.get_overview(db))
