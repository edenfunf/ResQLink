"""Generated artifact query endpoints."""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.schemas.artifact import (
    ArtifactStatus,
    ArtifactType,
    GeneratedArtifactDetail,
    GeneratedArtifactItem,
    GeneratedArtifactListResponse,
)
from app.services import artifact_service

router = APIRouter(prefix="/v1/artifacts", tags=["artifacts"])


@router.get(
    "",
    response_model=GeneratedArtifactListResponse,
    summary="List generated artifacts",
)
def list_artifacts(
    incident_id: uuid.UUID | None = Query(default=None),
    status_filter: ArtifactStatus | None = Query(default=None, alias="status"),
    artifact_type: ArtifactType | None = Query(default=None),
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
) -> GeneratedArtifactListResponse:
    rows, total = artifact_service.list_artifacts(
        db,
        incident_id=incident_id,
        status=status_filter.value if status_filter else None,
        artifact_type=artifact_type.value if artifact_type else None,
        limit=limit,
        offset=offset,
    )
    return GeneratedArtifactListResponse(
        items=[GeneratedArtifactItem.model_validate(row) for row in rows],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.get(
    "/{artifact_id}",
    response_model=GeneratedArtifactDetail,
    summary="Get a single artifact with its content",
)
def get_artifact(
    artifact_id: uuid.UUID,
    db: Session = Depends(get_db),
) -> GeneratedArtifactDetail:
    artifact = artifact_service.get_artifact(db, artifact_id)
    if artifact is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Artifact not found",
        )
    return GeneratedArtifactDetail.model_validate(artifact)
