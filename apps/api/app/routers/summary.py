"""Incident situation summary endpoint (read-model)."""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.schemas.summary import IncidentSummary
from app.services import summary_service
from app.services.summary_service import IncidentNotFoundError

router = APIRouter(prefix="/v1", tags=["summary"])


@router.get(
    "/incidents/{incident_id}/summary",
    response_model=IncidentSummary,
    summary="One-glance situation summary for an incident",
)
def incident_summary(
    incident_id: uuid.UUID,
    db: Session = Depends(get_db),
) -> IncidentSummary:
    try:
        return summary_service.get_incident_summary(db, incident_id)
    except IncidentNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Incident not found",
        )
