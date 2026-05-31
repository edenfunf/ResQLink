"""Incident query endpoints and the outbox inspection endpoint."""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.schemas.alert import LocationInput
from app.schemas.incident import (
    IncidentDetail,
    IncidentListItem,
    IncidentListResponse,
    OutboxEventItem,
    OutboxListResponse,
)
from app.services import incident_service, outbox_service

router = APIRouter(prefix="/v1", tags=["incidents"])


@router.get(
    "/incidents",
    response_model=IncidentListResponse,
    summary="List incidents",
)
def list_incidents(
    status_filter: str | None = Query(default=None, alias="status"),
    severity: str | None = Query(default=None),
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
) -> IncidentListResponse:
    rows, total = incident_service.list_incidents(
        db,
        status=status_filter,
        severity=severity,
        limit=limit,
        offset=offset,
    )
    return IncidentListResponse(
        items=[IncidentListItem.model_validate(row) for row in rows],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.get(
    "/incidents/{incident_id}",
    response_model=IncidentDetail,
    summary="Get a single incident",
)
def get_incident(
    incident_id: uuid.UUID,
    db: Session = Depends(get_db),
) -> IncidentDetail:
    incident = incident_service.get_incident(db, incident_id)
    if incident is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Incident not found",
        )

    return IncidentDetail(
        id=incident.id,
        slug=incident.slug,
        title=incident.title,
        scenario_type=incident.scenario_type,
        severity=incident.severity,
        location=LocationInput(
            county=incident.county,
            town=incident.town,
            river=incident.river,
            lat=incident.lat,
            lon=incident.lon,
        ),
        aoi=incident.aoi_geojson,
        status=incident.status,
        source_refs=incident.source_refs,
        created_at=incident.created_at,
        updated_at=incident.updated_at,
    )


@router.get(
    "/events/outbox",
    response_model=OutboxListResponse,
    tags=["events"],
    summary="List outbox events (development inspection)",
)
def list_outbox(
    processed: bool | None = Query(default=None),
    limit: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
) -> OutboxListResponse:
    rows = outbox_service.list_events(db, processed=processed, limit=limit)
    return OutboxListResponse(
        items=[OutboxEventItem.model_validate(row) for row in rows]
    )
