from __future__ import annotations

import uuid

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db.models import DisasterReport, Incident
from app.schemas.geojson import (
    GeoJSONFeature,
    GeoJSONFeatureCollection,
    GeoJSONPoint,
)
from app.schemas.report import DisasterReportCreate
from app.services import outbox_service, triage_service


class IncidentNotFoundError(Exception):
    pass


class IncidentArchivedError(Exception):
    pass


def create_report(
    db: Session, incident_id: uuid.UUID, payload: DisasterReportCreate
) -> DisasterReport:
    """Report insert and its outbox event commit in one transaction."""
    incident = db.get(Incident, incident_id)
    if incident is None:
        raise IncidentNotFoundError()
    if incident.status == "archived":
        raise IncidentArchivedError()

    triage_priority = triage_service.classify(
        payload.need_type.value, payload.severity.value
    )
    report = DisasterReport(
        incident_id=incident.id,
        reporter_name=payload.reporter_name,
        reporter_contact=payload.reporter_contact,
        need_type=payload.need_type.value,
        description=payload.description,
        severity=payload.severity.value,
        lat=payload.lat,
        lon=payload.lon,
        address=payload.address,
        status="new",
        verification_status="unverified",
        triage_priority=triage_priority,
        raw_payload=payload.model_dump(mode="json"),
    )
    db.add(report)
    db.flush()  # need report.id below

    outbox_service.enqueue_event(
        db,
        event_type="disaster_report.created",
        aggregate_id=report.id,
        payload={
            "incident_id": str(incident.id),
            "report_id": str(report.id),
            "need_type": report.need_type,
            "severity": report.severity,
            "triage_priority": report.triage_priority,
        },
    )

    db.commit()
    db.refresh(report)
    return report


def retriage_report(db: Session, report_id: uuid.UUID) -> DisasterReport | None:
    """Recompute and persist a report's triage priority."""
    report = db.get(DisasterReport, report_id)
    if report is None:
        return None
    report.triage_priority = triage_service.classify(
        report.need_type, report.severity
    )
    db.commit()
    db.refresh(report)
    return report


def set_verification(
    db: Session,
    report_id: uuid.UUID,
    verification_status: str,
    note: str | None = None,
) -> DisasterReport | None:
    """Human verification of a citizen report (verified / rejected / unverified).
    Writes the change to the outbox for audit."""
    report = db.get(DisasterReport, report_id)
    if report is None:
        return None
    report.verification_status = verification_status
    db.flush()
    outbox_service.enqueue_event(
        db,
        event_type="report.verification_changed",
        aggregate_id=report.id,
        payload={
            "incident_id": str(report.incident_id),
            "report_id": str(report.id),
            "verification_status": verification_status,
            "note": note,
        },
    )
    db.commit()
    db.refresh(report)
    return report


def list_reports(
    db: Session,
    incident_id: uuid.UUID,
    *,
    status: str | None = None,
    need_type: str | None = None,
    severity: str | None = None,
    limit: int = 20,
    offset: int = 0,
) -> tuple[list[DisasterReport], int]:
    filters = [DisasterReport.incident_id == incident_id]
    if status is not None:
        filters.append(DisasterReport.status == status)
    if need_type is not None:
        filters.append(DisasterReport.need_type == need_type)
    if severity is not None:
        filters.append(DisasterReport.severity == severity)

    total = db.scalar(
        select(func.count()).select_from(DisasterReport).where(*filters)
    )
    rows = db.scalars(
        select(DisasterReport)
        .where(*filters)
        .order_by(DisasterReport.created_at.desc())
        .limit(limit)
        .offset(offset)
    ).all()
    return list(rows), int(total or 0)


def get_report(db: Session, report_id: uuid.UUID) -> DisasterReport | None:
    return db.get(DisasterReport, report_id)


def to_geojson(
    db: Session, incident_id: uuid.UUID
) -> GeoJSONFeatureCollection:
    """Only geolocated reports; reporter PII is never put in properties."""
    rows = db.scalars(
        select(DisasterReport)
        .where(
            DisasterReport.incident_id == incident_id,
            DisasterReport.lat.is_not(None),
            DisasterReport.lon.is_not(None),
        )
        .order_by(DisasterReport.created_at.desc())
    ).all()

    features = [
        GeoJSONFeature(
            geometry=GeoJSONPoint(coordinates=[report.lon, report.lat]),
            properties={
                "report_id": str(report.id),
                "need_type": report.need_type,
                "severity": report.severity,
                "triage_priority": report.triage_priority,
                "status": report.status,
                "verification_status": report.verification_status,
                "address": report.address,
                "created_at": report.created_at.isoformat(),
            },
        )
        for report in rows
    ]
    return GeoJSONFeatureCollection(features=features)
