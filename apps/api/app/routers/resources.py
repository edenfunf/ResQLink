"""Resource offer endpoints + needs-resource matching."""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.schemas.resource import (
    MatchCandidate,
    MatchesResponse,
    MatchForReport,
    OfferStatus,
    OfferType,
    ResourceOfferCreate,
    ResourceOfferCreateResponse,
    ResourceOfferItem,
    ResourceOfferListResponse,
)
from app.services import incident_service, matching_service, resource_service
from app.services.resource_service import (
    IncidentArchivedError,
    IncidentNotFoundError,
)

router = APIRouter(prefix="/v1/incidents", tags=["resources"])


@router.post(
    "/{incident_id}/resources",
    response_model=ResourceOfferCreateResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a resource offer (volunteer / supply)",
)
def create_offer(
    incident_id: uuid.UUID,
    payload: ResourceOfferCreate,
    db: Session = Depends(get_db),
) -> ResourceOfferCreateResponse:
    try:
        offer = resource_service.create_offer(db, incident_id, payload)
    except IncidentNotFoundError:
        raise HTTPException(status_code=404, detail="Incident not found")
    except IncidentArchivedError:
        raise HTTPException(
            status_code=400,
            detail="Incident is archived and cannot accept new resources",
        )
    return ResourceOfferCreateResponse(
        offer_id=offer.id,
        status=OfferStatus(offer.status),
        message="資源已登記，將納入需求媒合",
    )


@router.get(
    "/{incident_id}/resources",
    response_model=ResourceOfferListResponse,
    summary="List resource offers (omits provider contact PII)",
)
def list_offers(
    incident_id: uuid.UUID,
    offer_type: OfferType | None = Query(default=None),
    status_filter: OfferStatus | None = Query(default=None, alias="status"),
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
) -> ResourceOfferListResponse:
    rows, total = resource_service.list_offers(
        db,
        incident_id,
        offer_type=offer_type.value if offer_type else None,
        status=status_filter.value if status_filter else None,
        limit=limit,
        offset=offset,
    )
    return ResourceOfferListResponse(
        items=[ResourceOfferItem.model_validate(r) for r in rows],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.get(
    "/{incident_id}/matches",
    response_model=MatchesResponse,
    summary="Suggested needs-resource matches (module: needs_matching_engine)",
)
def get_matches(
    incident_id: uuid.UUID,
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
) -> MatchesResponse:
    if incident_service.get_incident(db, incident_id) is None:
        raise HTTPException(status_code=404, detail="Incident not found")
    result = matching_service.compute_matches(db, incident_id, limit=limit, offset=offset)
    return MatchesResponse(
        incident_id=result["incident_id"],
        matched_reports=result["matched_reports"],
        unmatched_reports=result["unmatched_reports"],
        open_offers=result["open_offers"],
        total_reports=result["total_reports"],
        limit=result["limit"],
        offset=result["offset"],
        items=[
            MatchForReport(
                report_id=i["report_id"],
                need_type=i["need_type"],
                triage_priority=i["triage_priority"],
                description=i["description"],
                address=i["address"],
                candidates=[MatchCandidate(**c) for c in i["candidates"]],
            )
            for i in result["items"]
        ],
    )
