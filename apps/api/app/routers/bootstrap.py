"""Bootstrap endpoint: generate rescue components from an incident."""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.modules import ModuleNotExecutableError, ModuleNotFoundError
from app.schemas.bootstrap import (
    BootstrapArtifactSummary,
    BootstrapResponse,
    BootstrapReviewSummary,
)
from app.services import bootstrap_service
from app.services.bootstrap_service import IncidentNotFoundError

router = APIRouter(prefix="/v1/bootstrap", tags=["bootstrap"])


@router.post(
    "/incidents/{incident_id}",
    response_model=BootstrapResponse,
    summary="Generate rescue artifacts + review tasks for an incident",
)
def bootstrap_incident(
    incident_id: uuid.UUID,
    use_ai: bool = Query(default=False),
    module_ids: list[str] | None = Query(
        default=None,
        description="要生成的模組 id；省略則生成該災種的預設核心模組。",
    ),
    db: Session = Depends(get_db),
) -> BootstrapResponse:
    """Idempotent: re-bootstrapping returns the existing rows, no duplicates.

    Omit ``module_ids`` to generate the scenario's default core modules, or pass
    one or more module ids (from ``GET /v1/modules``) to generate exactly those.
    """
    try:
        artifacts, review_tasks, _created = bootstrap_service.bootstrap_incident(
            db, incident_id, use_ai=use_ai, module_ids=module_ids
        )
    except IncidentNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Incident not found",
        )
    except (ModuleNotFoundError, ModuleNotExecutableError) as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )

    return BootstrapResponse(
        incident_id=incident_id,
        status="pending_review",
        artifacts=[
            BootstrapArtifactSummary.model_validate(a) for a in artifacts
        ],
        review_tasks=[
            BootstrapReviewSummary.model_validate(r) for r in review_tasks
        ],
    )
