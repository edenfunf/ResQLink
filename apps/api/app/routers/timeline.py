"""Incident timeline endpoint — audit-grade history from the event outbox."""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.schemas.timeline import TimelineItem, TimelineResponse
from app.services import incident_service, timeline_service

router = APIRouter(prefix="/v1/incidents", tags=["timeline"])


@router.get(
    "/{incident_id}/timeline",
    response_model=TimelineResponse,
    summary="Incident event timeline (from the outbox)",
)
def get_timeline(
    incident_id: uuid.UUID,
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
) -> TimelineResponse:
    if incident_service.get_incident(db, incident_id) is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Incident not found",
        )
    items, total = timeline_service.build_timeline(
        db, incident_id, limit=limit, offset=offset
    )
    return TimelineResponse(
        incident_id=incident_id,
        items=[TimelineItem(**i) for i in items],
        total=total,
        limit=limit,
        offset=offset,
    )
