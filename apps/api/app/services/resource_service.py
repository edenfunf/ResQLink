"""Resource offers — the supply side (volunteers / goods) of the matching loop."""
from __future__ import annotations

import uuid

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db.models import Incident, ResourceOffer
from app.schemas.resource import ResourceOfferCreate
from app.services import outbox_service


class IncidentNotFoundError(Exception):
    pass


class IncidentArchivedError(Exception):
    pass


def create_offer(
    db: Session, incident_id: uuid.UUID, payload: ResourceOfferCreate
) -> ResourceOffer:
    incident = db.get(Incident, incident_id)
    if incident is None:
        raise IncidentNotFoundError()
    if incident.status == "archived":
        raise IncidentArchivedError()

    offer = ResourceOffer(
        incident_id=incident.id,
        offer_type=payload.offer_type.value,
        item=payload.item,
        quantity=payload.quantity,
        provider_name=payload.provider_name,
        provider_contact=payload.provider_contact,
        lat=payload.lat,
        lon=payload.lon,
        address=payload.address,
        available_time=payload.available_time,
        status="open",
        raw_payload=payload.model_dump(mode="json"),
    )
    db.add(offer)
    db.flush()

    outbox_service.enqueue_event(
        db,
        event_type="resource_offer.created",
        aggregate_id=offer.id,
        payload={
            "incident_id": str(incident.id),
            "offer_id": str(offer.id),
            "offer_type": offer.offer_type,
            "item": offer.item,
        },
    )

    db.commit()
    db.refresh(offer)
    return offer


def list_offers(
    db: Session,
    incident_id: uuid.UUID,
    *,
    offer_type: str | None = None,
    status: str | None = None,
    limit: int = 20,
    offset: int = 0,
) -> tuple[list[ResourceOffer], int]:
    filters = [ResourceOffer.incident_id == incident_id]
    if offer_type is not None:
        filters.append(ResourceOffer.offer_type == offer_type)
    if status is not None:
        filters.append(ResourceOffer.status == status)

    total = db.scalar(
        select(func.count()).select_from(ResourceOffer).where(*filters)
    )
    rows = db.scalars(
        select(ResourceOffer)
        .where(*filters)
        .order_by(ResourceOffer.created_at.desc())
        .limit(limit)
        .offset(offset)
    ).all()
    return list(rows), int(total or 0)


def get_offer(db: Session, offer_id: uuid.UUID) -> ResourceOffer | None:
    return db.get(ResourceOffer, offer_id)
