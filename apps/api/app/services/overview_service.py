"""Cross-incident operational overview (powers the Console dashboard)."""
from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db.models import (
    Assignment,
    DisasterReport,
    GeneratedArtifact,
    Incident,
    Publication,
    ResourceOffer,
    ReviewTask,
)

_OPEN_REPORT_STATUSES = ("new", "triaged", "in_progress")
_ACTIVE_ASSIGNMENT_STATUSES = ("assigned", "in_progress")


def _count(db: Session, model, *where) -> int:
    return int(db.scalar(select(func.count()).select_from(model).where(*where)) or 0)


def get_overview(db: Session) -> dict:
    return {
        "incidents_total": _count(db, Incident),
        "incidents_open": _count(db, Incident, Incident.status != "archived"),
        "reviews_pending": _count(db, ReviewTask, ReviewTask.status == "pending"),
        "artifacts_pending_review": _count(
            db, GeneratedArtifact, GeneratedArtifact.status == "pending_review"
        ),
        "artifacts_approved": _count(
            db, GeneratedArtifact, GeneratedArtifact.status == "approved"
        ),
        "reports_total": _count(db, DisasterReport),
        "reports_critical_open": _count(
            db,
            DisasterReport,
            DisasterReport.triage_priority == "critical",
            DisasterReport.status.in_(_OPEN_REPORT_STATUSES),
        ),
        "reports_unverified": _count(
            db, DisasterReport, DisasterReport.verification_status == "unverified"
        ),
        "resources_open": _count(db, ResourceOffer, ResourceOffer.status == "open"),
        "assignments_active": _count(
            db, Assignment, Assignment.status.in_(_ACTIVE_ASSIGNMENT_STATUSES)
        ),
        "publications_total": _count(db, Publication),
    }
