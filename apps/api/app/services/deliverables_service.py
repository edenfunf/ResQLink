"""Aggregate an incident's artifacts into outcome-oriented deliverables.

Read-model only: it groups existing ``generated_artifacts`` by the deliverable
partition (``app.modules.deliverables``), rolls up a status per deliverable, and
resolves the front/admin URLs for the incident. Nothing is written here.
"""
from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import GeneratedArtifact, Incident
from app.modules import registry
from app.modules.deliverables import DELIVERABLES, DeliverableSpec


class IncidentNotFoundError(Exception):
    pass


def _module_name(artifact_type: str) -> str:
    spec = registry.get(artifact_type)
    return spec.name if spec else artifact_type


def _resolve(template: str, incident: Incident) -> str:
    return template.format(id=incident.id, slug=incident.slug)


def _rollup_status(total: int, approved: int, pending: int) -> str:
    """Coarse, demo-clear status for a deliverable.

    - ``empty``       — no member artifact generated yet
    - ``in_review``   — generated but still has items awaiting review
    - ``ready``       — at least one approved and nothing left pending
    - ``draft``       — generated, none approved, none pending (e.g. all rejected)
    """
    if total == 0:
        return "empty"
    if pending > 0:
        return "in_review"
    if approved > 0:
        return "ready"
    return "draft"


def _build_one(
    spec: DeliverableSpec,
    incident: Incident,
    by_type: dict[str, list[GeneratedArtifact]],
) -> dict:
    members: list[dict] = []
    total = approved = pending = 0
    for artifact_type in spec.members:
        arts = by_type.get(artifact_type, [])
        present = len(arts) > 0
        # an incident holds at most one artifact per type, but be defensive
        art = arts[0] if arts else None
        if art is not None:
            total += 1
            if art.status == "approved":
                approved += 1
            elif art.status == "pending_review":
                pending += 1
        members.append(
            {
                "artifact_type": artifact_type,
                "name": _module_name(artifact_type),
                "present": present,
                "artifact_id": art.id if art else None,
                "status": art.status if art else None,
            }
        )

    return {
        "key": spec.key,
        "name": spec.name,
        "tagline": spec.tagline,
        "accent": spec.accent,
        "icon": spec.icon,
        "status": _rollup_status(total, approved, pending),
        "member_total": len(spec.members),
        "generated_count": total,
        "approved_count": approved,
        "pending_count": pending,
        "front": {
            "label": spec.front.label,
            "url": _resolve(spec.front.url_template, incident),
            "kind": spec.front.kind,
        },
        "admin": {
            "label": spec.admin.label,
            "url": _resolve(spec.admin.url_template, incident),
            "kind": spec.admin.kind,
        },
        "members": members,
    }


def build_deliverables(db: Session, incident_id: uuid.UUID) -> dict:
    incident = db.get(Incident, incident_id)
    if incident is None:
        raise IncidentNotFoundError()

    rows = db.scalars(
        select(GeneratedArtifact).where(
            GeneratedArtifact.incident_id == incident_id
        )
    ).all()
    by_type: dict[str, list[GeneratedArtifact]] = {}
    for art in rows:
        by_type.setdefault(art.artifact_type, []).append(art)

    items = [_build_one(spec, incident, by_type) for spec in DELIVERABLES]
    return {
        "incident_id": incident.id,
        "slug": incident.slug,
        "items": items,
    }
