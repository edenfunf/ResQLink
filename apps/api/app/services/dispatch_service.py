"""Volunteer/resource dispatch (module: volunteer_dispatch).

Where matching only *suggests*, dispatch *commits*: it assigns a resource offer
to a report and tracks the work through to completion, keeping the report and
offer statuses in sync. Every transition is written to the outbox.
"""
from __future__ import annotations

import uuid

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db.models import Assignment, DisasterReport, Incident, ResourceOffer
from app.services import outbox_service

# allowed status transitions
_TRANSITIONS: dict[str, set[str]] = {
    "assigned": {"in_progress", "done", "cancelled"},
    "in_progress": {"done", "cancelled"},
    "done": set(),
    "cancelled": set(),
}


class IncidentNotFoundError(Exception):
    pass


class ReportNotFoundError(Exception):
    pass


class OfferNotFoundError(Exception):
    pass


class AssignmentNotFoundError(Exception):
    pass


class InvalidTransitionError(Exception):
    def __init__(self, frm: str, to: str) -> None:
        super().__init__(f"Cannot transition assignment from '{frm}' to '{to}'.")
        self.frm = frm
        self.to = to


def create_assignment(
    db: Session,
    incident_id: uuid.UUID,
    report_id: uuid.UUID,
    offer_id: uuid.UUID,
    note: str | None,
) -> Assignment:
    incident = db.get(Incident, incident_id)
    if incident is None:
        raise IncidentNotFoundError()
    report = db.get(DisasterReport, report_id)
    if report is None or report.incident_id != incident_id:
        raise ReportNotFoundError()
    offer = db.get(ResourceOffer, offer_id)
    if offer is None or offer.incident_id != incident_id:
        raise OfferNotFoundError()

    assignment = Assignment(
        incident_id=incident_id,
        report_id=report_id,
        offer_id=offer_id,
        status="assigned",
        note=note,
    )
    db.add(assignment)
    # keep the two sides in sync
    report.status = "in_progress"
    offer.status = "matched"
    db.flush()

    outbox_service.enqueue_event(
        db,
        event_type="assignment.created",
        aggregate_id=assignment.id,
        payload={
            "incident_id": str(incident_id),
            "assignment_id": str(assignment.id),
            "report_id": str(report_id),
            "offer_id": str(offer_id),
        },
    )
    db.commit()
    db.refresh(assignment)
    return assignment


def update_status(
    db: Session, assignment_id: uuid.UUID, new_status: str, note: str | None
) -> Assignment:
    assignment = db.get(Assignment, assignment_id)
    if assignment is None:
        raise AssignmentNotFoundError()
    if new_status != assignment.status and new_status not in _TRANSITIONS.get(
        assignment.status, set()
    ):
        raise InvalidTransitionError(assignment.status, new_status)

    assignment.status = new_status
    if note is not None:
        assignment.note = note

    report = db.get(DisasterReport, assignment.report_id)
    offer = db.get(ResourceOffer, assignment.offer_id)
    if new_status == "done":
        if report is not None:
            report.status = "resolved"
        if offer is not None:
            offer.status = "closed"
    elif new_status == "cancelled":
        # release both sides back to the pool
        if report is not None and report.status == "in_progress":
            report.status = "triaged"
        if offer is not None and offer.status == "matched":
            offer.status = "open"

    db.flush()
    outbox_service.enqueue_event(
        db,
        event_type="assignment.updated",
        aggregate_id=assignment.id,
        payload={
            "incident_id": str(assignment.incident_id),
            "assignment_id": str(assignment.id),
            "status": new_status,
        },
    )
    db.commit()
    db.refresh(assignment)
    return assignment


def list_assignments(
    db: Session,
    incident_id: uuid.UUID,
    *,
    status: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> tuple[list[Assignment], int]:
    filters = [Assignment.incident_id == incident_id]
    if status is not None:
        filters.append(Assignment.status == status)
    total = db.scalar(select(func.count()).select_from(Assignment).where(*filters))
    rows = db.scalars(
        select(Assignment)
        .where(*filters)
        .order_by(Assignment.created_at.desc())
        .limit(limit)
        .offset(offset)
    ).all()
    return list(rows), int(total or 0)
