"""Deliverables endpoint — the outcome view of an incident (read-model).

Groups an incident's generated artifacts into recognisable outcomes (rescue
website, FB page, LINE channel, supply ops, volunteer ops) with a rolled-up
status and front/admin entry points, so the agent's output can be presented as a
handful of outcomes rather than a flat list of modules.
"""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.schemas.deliverable import DeliverablesResponse
from app.services import deliverables_service
from app.services.deliverables_service import IncidentNotFoundError

router = APIRouter(prefix="/v1", tags=["deliverables"])


@router.get(
    "/incidents/{incident_id}/deliverables",
    response_model=DeliverablesResponse,
    summary="Outcome view: artifacts grouped into deliverables with front/admin links",
)
def incident_deliverables(
    incident_id: uuid.UUID,
    db: Session = Depends(get_db),
) -> DeliverablesResponse:
    try:
        result = deliverables_service.build_deliverables(db, incident_id)
    except IncidentNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Incident not found",
        )
    return DeliverablesResponse.model_validate(result)
