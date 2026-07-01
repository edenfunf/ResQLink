from __future__ import annotations

import uuid

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db.models import DisasterReport, GeneratedArtifact, Incident, ReviewTask
from app.schemas.summary import (
    ArtifactsSummary,
    CountByKey,
    IncidentSummary,
    ReadinessSummary,
    ReportsSummary,
    ReviewsSummary,
)

# stable display order for the need-type breakdown
_NEED_TYPE_ORDER = [
    "flooding",
    "mud_removal",
    "road_blocked",
    "power_outage",
    "building_collapse",
    "fire",
    "gas_leak",
    "trapped_person",
    "missing_person",
    "medical_need",
    "supply_need",
    "other",
]
_SEVERITY_ORDER = ["critical", "high", "medium", "low"]
_TRIAGE_ORDER = ["critical", "high", "normal", "low"]
_OPEN_REPORT_STATUSES = ("new", "triaged", "in_progress")


class IncidentNotFoundError(Exception):
    pass


def _counts_by(db: Session, model, column, incident_id: uuid.UUID) -> dict[str, int]:
    rows = db.execute(
        select(column, func.count())
        .where(model.incident_id == incident_id)
        .group_by(column)
    ).all()
    return {key: count for key, count in rows}


def _ordered(counts: dict[str, int], order: list[str]) -> list[CountByKey]:
    seen = set()
    out: list[CountByKey] = []
    for key in order:
        if key in counts:
            out.append(CountByKey(key=key, count=counts[key]))
            seen.add(key)
    for key, count in counts.items():
        if key not in seen:
            out.append(CountByKey(key=key, count=count))
    return out


def get_incident_summary(db: Session, incident_id: uuid.UUID) -> IncidentSummary:
    incident = db.get(Incident, incident_id)
    if incident is None:
        raise IncidentNotFoundError()

    art_counts = _counts_by(db, GeneratedArtifact, GeneratedArtifact.status, incident_id)
    rev_counts = _counts_by(db, ReviewTask, ReviewTask.status, incident_id)
    need_counts = _counts_by(db, DisasterReport, DisasterReport.need_type, incident_id)
    sev_counts = _counts_by(db, DisasterReport, DisasterReport.severity, incident_id)
    triage_counts = _counts_by(
        db, DisasterReport, DisasterReport.triage_priority, incident_id
    )

    reports_total = db.scalar(
        select(func.count())
        .select_from(DisasterReport)
        .where(DisasterReport.incident_id == incident_id)
    ) or 0
    geolocated = db.scalar(
        select(func.count())
        .select_from(DisasterReport)
        .where(
            DisasterReport.incident_id == incident_id,
            DisasterReport.lat.is_not(None),
            DisasterReport.lon.is_not(None),
        )
    ) or 0
    critical_open = db.scalar(
        select(func.count())
        .select_from(DisasterReport)
        .where(
            DisasterReport.incident_id == incident_id,
            DisasterReport.triage_priority == "critical",
            DisasterReport.status.in_(_OPEN_REPORT_STATUSES),
        )
    ) or 0

    artifacts = ArtifactsSummary(
        total=sum(art_counts.values()),
        pending_review=art_counts.get("pending_review", 0),
        approved=art_counts.get("approved", 0),
        rejected=art_counts.get("rejected", 0),
        archived=art_counts.get("archived", 0),
    )
    reviews = ReviewsSummary(
        total=sum(rev_counts.values()),
        pending=rev_counts.get("pending", 0),
        approved=rev_counts.get("approved", 0),
        rejected=rev_counts.get("rejected", 0),
    )
    reports = ReportsSummary(
        total=int(reports_total),
        geolocated=int(geolocated),
        critical_open=int(critical_open),
        by_need_type=_ordered(need_counts, _NEED_TYPE_ORDER),
        by_severity=_ordered(sev_counts, _SEVERITY_ORDER),
        by_triage_priority=_ordered(triage_counts, _TRIAGE_ORDER),
    )
    readiness = ReadinessSummary(
        bootstrapped=artifacts.total > 0,
        has_public_content=artifacts.approved > 0,
        has_reports=reports.total > 0,
    )

    return IncidentSummary(
        incident_id=incident.id,
        slug=incident.slug,
        title=incident.title,
        severity=incident.severity,
        status=incident.status,
        artifacts=artifacts,
        reviews=reviews,
        reports=reports,
        readiness=readiness,
    )
