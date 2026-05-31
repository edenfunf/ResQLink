"""Disaster report endpoints: submit, list, detail, and GeoJSON export."""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.schemas.geojson import GeoJSONFeatureCollection
from app.schemas.report import (
    DisasterReportCreate,
    DisasterReportCreateResponse,
    DisasterReportDetail,
    DisasterReportItem,
    ReportListResponse,
    ReportNeedType,
    ReportSeverity,
    ReportStatus,
)
from app.services import report_service
from app.services.report_service import (
    IncidentArchivedError,
    IncidentNotFoundError,
)

router = APIRouter(prefix="/v1", tags=["reports"])


@router.post(
    "/incidents/{incident_id}/reports",
    response_model=DisasterReportCreateResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Submit a citizen disaster report",
)
def submit_report(
    incident_id: uuid.UUID,
    payload: DisasterReportCreate,
    db: Session = Depends(get_db),
) -> DisasterReportCreateResponse:
    try:
        report = report_service.create_report(db, incident_id, payload)
    except IncidentNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Incident not found",
        )
    except IncidentArchivedError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Incident is archived and cannot accept new reports",
        )

    return DisasterReportCreateResponse(
        report_id=report.id,
        status=ReportStatus(report.status),
        message="通報已送出，將進入審核與處理流程",
    )


@router.get(
    "/incidents/{incident_id}/reports",
    response_model=ReportListResponse,
    summary="List disaster reports for an incident",
)
def list_reports(
    incident_id: uuid.UUID,
    status_filter: ReportStatus | None = Query(default=None, alias="status"),
    need_type: ReportNeedType | None = Query(default=None),
    severity: ReportSeverity | None = Query(default=None),
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
) -> ReportListResponse:
    """List items omit reporter_contact (PII)."""
    rows, total = report_service.list_reports(
        db,
        incident_id,
        status=status_filter.value if status_filter else None,
        need_type=need_type.value if need_type else None,
        severity=severity.value if severity else None,
        limit=limit,
        offset=offset,
    )
    return ReportListResponse(
        items=[DisasterReportItem.model_validate(row) for row in rows],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.get(
    "/incidents/{incident_id}/reports.geojson",
    response_model=GeoJSONFeatureCollection,
    summary="Export geolocated reports as a GeoJSON FeatureCollection",
)
def reports_geojson(
    incident_id: uuid.UUID,
    db: Session = Depends(get_db),
) -> GeoJSONFeatureCollection:
    """Only geolocated reports; no PII in properties."""
    return report_service.to_geojson(db, incident_id)


@router.get(
    "/reports/{report_id}",
    response_model=DisasterReportDetail,
    summary="Get a single disaster report (exposes PII — gate in production)",
)
def get_report(
    report_id: uuid.UUID,
    db: Session = Depends(get_db),
) -> DisasterReportDetail:
    report = report_service.get_report(db, report_id)
    if report is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Report not found",
        )
    return DisasterReportDetail.model_validate(report)
