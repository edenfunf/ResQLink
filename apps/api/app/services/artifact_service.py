from __future__ import annotations

import uuid

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db.models import GeneratedArtifact


def list_artifacts(
    db: Session,
    *,
    incident_id: uuid.UUID | None = None,
    status: str | None = None,
    artifact_type: str | None = None,
    limit: int = 20,
    offset: int = 0,
) -> tuple[list[GeneratedArtifact], int]:
    filters = []
    if incident_id is not None:
        filters.append(GeneratedArtifact.incident_id == incident_id)
    if status is not None:
        filters.append(GeneratedArtifact.status == status)
    if artifact_type is not None:
        filters.append(GeneratedArtifact.artifact_type == artifact_type)

    total = db.scalar(
        select(func.count()).select_from(GeneratedArtifact).where(*filters)
    )
    rows = db.scalars(
        select(GeneratedArtifact)
        .where(*filters)
        .order_by(GeneratedArtifact.created_at.asc())
        .limit(limit)
        .offset(offset)
    ).all()
    return list(rows), int(total or 0)


def get_artifact(
    db: Session, artifact_id: uuid.UUID
) -> GeneratedArtifact | None:
    return db.get(GeneratedArtifact, artifact_id)


def update_artifact_status(
    db: Session, artifact_id: uuid.UUID, status: str
) -> GeneratedArtifact | None:
    artifact = db.get(GeneratedArtifact, artifact_id)
    if artifact is None:
        return None
    artifact.status = status
    db.flush()
    return artifact
