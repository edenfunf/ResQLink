from __future__ import annotations

import uuid

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db.models import Incident
from app.schemas.alert import AlertEventCreate
from app.services import outbox_service
from app.utils.slug import short_suffix, slugify

# alert event_type -> incident scenario_type
_SCENARIO_BY_EVENT_TYPE = {
    "barrier_lake_alert": "barrier_lake",
}


def _unique_slug(db: Session, title: str) -> str:
    base = slugify(title)
    exists = db.scalar(select(Incident.id).where(Incident.slug == base))
    if exists is None:
        return base
    return f"{base}-{short_suffix()}"


def create_incident_from_alert(
    db: Session, payload: AlertEventCreate
) -> Incident:
    """Insert and the outbox incident.created event commit in one transaction."""
    scenario_type = _SCENARIO_BY_EVENT_TYPE[payload.event_type]
    slug = _unique_slug(db, payload.title)

    incident = Incident(
        slug=slug,
        title=payload.title,
        scenario_type=scenario_type,
        severity=payload.severity,
        county=payload.location.county,
        town=payload.location.town,
        river=payload.location.river,
        lat=payload.location.lat,
        lon=payload.location.lon,
        aoi_geojson=payload.aoi,
        status="draft",
        source_refs=[
            ref.model_dump(mode="json") for ref in payload.source_refs
        ],
    )
    db.add(incident)
    db.flush()  # need incident.id below

    outbox_service.enqueue_event(
        db,
        event_type="incident.created",
        aggregate_id=incident.id,
        payload={
            "incident_id": str(incident.id),
            "slug": incident.slug,
            "title": incident.title,
            "severity": incident.severity,
            "source": payload.source,
        },
    )

    db.commit()
    db.refresh(incident)
    return incident


def list_incidents(
    db: Session,
    *,
    status: str | None = None,
    severity: str | None = None,
    limit: int = 20,
    offset: int = 0,
) -> tuple[list[Incident], int]:
    filters = []
    if status is not None:
        filters.append(Incident.status == status)
    if severity is not None:
        filters.append(Incident.severity == severity)

    total = db.scalar(
        select(func.count()).select_from(Incident).where(*filters)
    )

    rows = (
        db.scalars(
            select(Incident)
            .where(*filters)
            .order_by(Incident.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
        .all()
    )
    return list(rows), int(total or 0)


def get_incident(db: Session, incident_id: uuid.UUID) -> Incident | None:
    return db.get(Incident, incident_id)
