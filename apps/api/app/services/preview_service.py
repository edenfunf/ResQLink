from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import GeneratedArtifact, Incident


class IncidentNotFoundError(Exception):
    pass


def get_public_preview(
    db: Session, slug: str
) -> tuple[Incident, list[GeneratedArtifact]]:
    """Returns the incident and only its approved artifacts (no PII)."""
    incident = db.scalar(select(Incident).where(Incident.slug == slug))
    if incident is None:
        raise IncidentNotFoundError()

    artifacts = list(
        db.scalars(
            select(GeneratedArtifact)
            .where(
                GeneratedArtifact.incident_id == incident.id,
                GeneratedArtifact.status == "approved",
            )
            .order_by(GeneratedArtifact.created_at.asc())
        ).all()
    )
    return incident, artifacts
