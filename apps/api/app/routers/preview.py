"""Public preview endpoint: approved-only incident portal."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.schemas.alert import LocationInput
from app.schemas.preview import (
    PublicArtifactItem,
    PublicEndpoints,
    PublicIncidentInfo,
    PublicPreviewResponse,
)
from app.services import preview_service
from app.services.preview_service import IncidentNotFoundError

router = APIRouter(prefix="/v1/public", tags=["public"])


@router.get(
    "/preview/{slug}",
    response_model=PublicPreviewResponse,
    summary="Public rescue-portal preview (approved artifacts only)",
)
def public_preview(
    slug: str,
    db: Session = Depends(get_db),
) -> PublicPreviewResponse:
    """Approved artifacts only; no review tasks, no PII."""
    try:
        incident, artifacts = preview_service.get_public_preview(db, slug)
    except IncidentNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Incident not found",
        )

    return PublicPreviewResponse(
        incident=PublicIncidentInfo(
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
            status=incident.status,
        ),
        artifacts=[
            PublicArtifactItem.model_validate(a) for a in artifacts
        ],
        public_endpoints=PublicEndpoints(
            reports_geojson=f"/v1/incidents/{incident.id}/reports.geojson",
            submit_report=f"/v1/incidents/{incident.id}/reports",
        ),
    )
