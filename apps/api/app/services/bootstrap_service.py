"""Generate rescue components and review tasks from an incident.

Bootstrap is now registry-driven: with no selection it runs the scenario's
``default_enabled`` modules (the six core artifacts — backward compatible); with
an explicit ``module_ids`` selection it runs exactly those modules (the seam the
orchestrating agent plugs into). It is idempotent per module: a module whose
artifact already exists for the incident is skipped, never duplicated.
"""
from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.models import GeneratedArtifact, Incident, ReviewTask
from app.modules import ModuleNotExecutableError, ModuleNotFoundError, registry
from app.modules.base import ModuleSpec
from app.modules.scenarios import get_profile
from app.services import ai_agent, outbox_service


class IncidentNotFoundError(Exception):
    pass


def _existing_artifacts(db: Session, incident_id: uuid.UUID) -> list[GeneratedArtifact]:
    return list(
        db.scalars(
            select(GeneratedArtifact)
            .where(GeneratedArtifact.incident_id == incident_id)
            .order_by(GeneratedArtifact.created_at.asc())
        ).all()
    )


def _reviews_for_incident(db: Session, incident_id: uuid.UUID) -> list[ReviewTask]:
    return list(
        db.scalars(
            select(ReviewTask)
            .where(ReviewTask.incident_id == incident_id)
            .order_by(ReviewTask.created_at.asc())
        ).all()
    )


def _resolve_modules(
    scenario_type: str, module_ids: list[str] | None
) -> list[ModuleSpec]:
    """Default selection = the scenario's default modules. Explicit selection is
    validated: unknown ids raise ModuleNotFoundError, non-executable ones raise
    ModuleNotExecutableError."""
    if module_ids is None:
        return registry.defaults_for_scenario(scenario_type)

    specs: list[ModuleSpec] = []
    seen: set[str] = set()
    for module_id in module_ids:
        if module_id in seen:
            continue
        seen.add(module_id)
        spec = registry.get(module_id)
        if spec is None:
            raise ModuleNotFoundError(module_id)
        if not spec.is_bootstrap_executable():
            raise ModuleNotExecutableError(module_id, endpoint=spec.endpoint)
        specs.append(spec)
    return specs


def _apply_ai_texts(module_id: str, content: dict, ai_texts: dict) -> bool:
    """Splice AI-drafted free-text into a rule-based content dict. The structure
    stays rule-based; only text fields are replaced. Returns True if applied."""
    if module_id == "public_notice_draft" and ai_texts.get("notice"):
        content["title"] = ai_texts["notice"]["title"]
        content["body"] = ai_texts["notice"]["body"]
        return True
    if module_id == "microsite_config" and ai_texts.get("site_title"):
        content["site_title"] = ai_texts["site_title"]
        return True
    if module_id == "damage_report_form" and ai_texts.get("damage_desc"):
        content["description"] = ai_texts["damage_desc"]
        return True
    return False


def bootstrap_incident(
    db: Session,
    incident_id: uuid.UUID,
    use_ai: bool = False,
    module_ids: list[str] | None = None,
) -> tuple[list[GeneratedArtifact], list[ReviewTask], bool]:
    """Return (artifacts, review_tasks, created) for the selected modules.

    Idempotent: a module whose artifact already exists is returned, not
    re-created. With use_ai, free-text fields are drafted by the AI layer
    (falling back to rule-based per field); every artifact still starts as
    pending_review.
    """
    incident = db.get(Incident, incident_id)
    if incident is None:
        raise IncidentNotFoundError()

    selected = _resolve_modules(incident.scenario_type, module_ids)
    selected_ids = {spec.id for spec in selected}

    existing = _existing_artifacts(db, incident_id)
    existing_by_type = {a.artifact_type: a for a in existing}

    profile = get_profile(incident.scenario_type)
    to_create = [s for s in selected if s.id not in existing_by_type]

    ai_texts = ai_agent.draft_texts(incident) if (use_ai and to_create) else {}

    # Demo mode publishes generated content immediately so the public site and
    # deliverable fronts have something to show without a manual approval step.
    auto = settings.DEMO_AUTO_APPROVE
    artifact_status = "approved" if auto else "pending_review"
    review_status = "approved" if auto else "pending"

    created_any = False
    for spec in to_create:
        risk_level = spec.risk_for(incident.severity)
        content = spec.generate(incident, profile)
        ai_applied = _apply_ai_texts(spec.id, content, ai_texts)
        artifact = GeneratedArtifact(
            incident_id=incident.id,
            artifact_type=spec.id,
            title=spec.name,
            content=content,
            status=artifact_status,
            risk_level=risk_level,
            created_by="ai_agent" if ai_applied else "system",
        )
        db.add(artifact)
        db.flush()

        review_task = ReviewTask(
            incident_id=incident.id,
            artifact_id=artifact.id,
            review_type=spec.review_type_for(risk_level),
            risk_level=risk_level,
            status=review_status,
        )
        db.add(review_task)
        created_any = True

    if created_any:
        db.flush()
        outbox_service.enqueue_event(
            db,
            event_type="incident.bootstrapped",
            aggregate_id=incident.id,
            payload={
                "incident_id": str(incident.id),
                "module_ids": [s.id for s in to_create],
                "artifact_count": len(to_create),
                "mode": "ai" if ai_texts else "rule",
            },
        )
        db.commit()

    # Re-read so the response reflects the selected modules (existing + created).
    all_artifacts = _existing_artifacts(db, incident_id)
    artifacts = [a for a in all_artifacts if a.artifact_type in selected_ids]
    artifact_ids = {a.id for a in artifacts}
    review_tasks = [
        r for r in _reviews_for_incident(db, incident_id) if r.artifact_id in artifact_ids
    ]
    return artifacts, review_tasks, created_any
