"""Alert ingestion endpoint."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.schemas.alert import SUPPORTED_EVENT_TYPES, AlertEventCreate
from app.schemas.incident import IncidentCreateResponse
from app.services import incident_service

router = APIRouter(prefix="/v1/events", tags=["events"])


@router.post(
    "/alerts",
    response_model=IncidentCreateResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Ingest a disaster alert and create an incident",
)
def create_alert(
    payload: AlertEventCreate,
    db: Session = Depends(get_db),
) -> IncidentCreateResponse:
    """event_type is a free string so unsupported values return 400, not 422."""
    if payload.event_type not in SUPPORTED_EVENT_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Unsupported event_type. Supported: "
                + ", ".join(SUPPORTED_EVENT_TYPES)
            ),
        )

    try:
        incident = incident_service.create_incident_from_alert(db, payload)
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to persist incident.",
        )

    return IncidentCreateResponse(
        incident_id=incident.id,
        slug=incident.slug,
        status="created",
        next=f"/v1/incidents/{incident.id}",
    )
