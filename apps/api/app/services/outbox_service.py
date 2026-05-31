from __future__ import annotations

import uuid

from sqlalchemy.orm import Session

from app.db.models import EventOutbox


def enqueue_event(
    db: Session,
    *,
    event_type: str,
    aggregate_id: uuid.UUID | None,
    payload: dict,
) -> EventOutbox:
    # Caller commits, so the event and its aggregate persist atomically.
    event = EventOutbox(
        event_type=event_type,
        aggregate_id=aggregate_id,
        payload=payload,
        processed=False,
    )
    db.add(event)
    db.flush()
    return event


def list_events(
    db: Session,
    *,
    processed: bool | None = None,
    limit: int = 20,
) -> list[EventOutbox]:
    query = db.query(EventOutbox)
    if processed is not None:
        query = query.filter(EventOutbox.processed == processed)
    return (
        query.order_by(EventOutbox.created_at.desc())
        .limit(limit)
        .all()
    )
