"""Dispatch endpoints — assign resources to reports and track status."""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.schemas.assignment import (
    AssignmentCreate,
    AssignmentItem,
    AssignmentListResponse,
    AssignmentStatus,
    AssignmentUpdate,
)
from app.services import dispatch_service
from app.services.dispatch_service import (
    AssignmentNotFoundError,
    IncidentNotFoundError,
    InvalidTransitionError,
    OfferNotFoundError,
    ReportNotFoundError,
)

router = APIRouter(prefix="/v1", tags=["dispatch"])


@router.post(
    "/incidents/{incident_id}/assignments",
    response_model=AssignmentItem,
    status_code=status.HTTP_201_CREATED,
    summary="Dispatch a resource to a report (module: volunteer_dispatch)",
)
def create_assignment(
    incident_id: uuid.UUID,
    payload: AssignmentCreate,
    db: Session = Depends(get_db),
) -> AssignmentItem:
    try:
        assignment = dispatch_service.create_assignment(
            db, incident_id, payload.report_id, payload.offer_id, payload.note
        )
    except IncidentNotFoundError:
        raise HTTPException(status_code=404, detail="Incident not found")
    except ReportNotFoundError:
        raise HTTPException(status_code=404, detail="Report not found in this incident")
    except OfferNotFoundError:
        raise HTTPException(status_code=404, detail="Resource offer not found in this incident")
    return AssignmentItem.model_validate(assignment)


@router.get(
    "/incidents/{incident_id}/assignments",
    response_model=AssignmentListResponse,
    summary="List dispatch assignments",
)
def list_assignments(
    incident_id: uuid.UUID,
    status_filter: AssignmentStatus | None = Query(default=None, alias="status"),
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
) -> AssignmentListResponse:
    rows, total = dispatch_service.list_assignments(
        db,
        incident_id,
        status=status_filter.value if status_filter else None,
        limit=limit,
        offset=offset,
    )
    return AssignmentListResponse(
        items=[AssignmentItem.model_validate(r) for r in rows],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.patch(
    "/assignments/{assignment_id}",
    response_model=AssignmentItem,
    summary="Update an assignment's status",
)
def update_assignment(
    assignment_id: uuid.UUID,
    payload: AssignmentUpdate,
    db: Session = Depends(get_db),
) -> AssignmentItem:
    try:
        assignment = dispatch_service.update_status(
            db, assignment_id, payload.status.value, payload.note
        )
    except AssignmentNotFoundError:
        raise HTTPException(status_code=404, detail="Assignment not found")
    except InvalidTransitionError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return AssignmentItem.model_validate(assignment)
