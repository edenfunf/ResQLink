"""Generic submissions for config-driven generated forms.

A generated form artifact carries a ``fields`` array (name / type / required /
options / pii). This service turns any such *approved* form into a live intake:
it validates required fields, keeps only declared fields, stores the answers, and
masks PII fields on read. No per-form endpoint needed — one renderer + one
endpoint makes every generated form submittable.
"""
from __future__ import annotations

import uuid

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db.models import FormSubmission, GeneratedArtifact
from app.services import outbox_service


class FormNotFoundError(Exception):
    pass


class NotAFormError(Exception):
    pass


class FormNotApprovedError(Exception):
    pass


class MissingFieldError(Exception):
    def __init__(self, label: str) -> None:
        super().__init__(f"Missing required field: {label}")
        self.label = label


def _fields(artifact: GeneratedArtifact) -> list[dict] | None:
    content = artifact.content
    if not isinstance(content, dict):
        return None
    fields = content.get("fields")
    if isinstance(fields, list) and fields:
        return [f for f in fields if isinstance(f, dict) and f.get("name")]
    return None


def submit(
    db: Session, artifact_id: uuid.UUID, payload: dict
) -> FormSubmission:
    artifact = db.get(GeneratedArtifact, artifact_id)
    if artifact is None:
        raise FormNotFoundError()
    fields = _fields(artifact)
    if fields is None:
        raise NotAFormError()
    if artifact.status != "approved":
        raise FormNotApprovedError()

    declared = {f["name"] for f in fields}
    clean = {k: v for k, v in (payload or {}).items() if k in declared}
    for field in fields:
        if field.get("required"):
            value = clean.get(field["name"])
            if value is None or value == "" or value == []:
                raise MissingFieldError(field.get("label") or field["name"])

    submission = FormSubmission(
        incident_id=artifact.incident_id,
        artifact_id=artifact.id,
        form_key=(artifact.content.get("form_key") or artifact.artifact_type),
        payload=clean,
    )
    db.add(submission)
    db.flush()
    outbox_service.enqueue_event(
        db,
        event_type="form_submission.created",
        aggregate_id=submission.id,
        payload={
            "incident_id": str(artifact.incident_id),
            "artifact_id": str(artifact.id),
            "form_key": submission.form_key,
        },
    )
    db.commit()
    db.refresh(submission)
    return submission


def list_submissions(
    db: Session, artifact_id: uuid.UUID, *, limit: int = 50, offset: int = 0
) -> tuple[list[dict], int] | None:
    """Returns (masked submissions, total), or None if the artifact is not a form."""
    artifact = db.get(GeneratedArtifact, artifact_id)
    if artifact is None:
        return None
    fields = _fields(artifact)
    if fields is None:
        return None
    pii = {f["name"] for f in fields if f.get("pii")}

    total = db.scalar(
        select(func.count())
        .select_from(FormSubmission)
        .where(FormSubmission.artifact_id == artifact_id)
    )
    rows = db.scalars(
        select(FormSubmission)
        .where(FormSubmission.artifact_id == artifact_id)
        .order_by(FormSubmission.created_at.desc())
        .limit(limit)
        .offset(offset)
    ).all()

    out = []
    for sub in rows:
        masked = dict(sub.payload)
        for key in pii:
            if masked.get(key) not in (None, ""):
                masked[key] = "***"
        out.append(
            {
                "id": sub.id,
                "artifact_id": sub.artifact_id,
                "form_key": sub.form_key,
                "payload": masked,
                "created_at": sub.created_at,
            }
        )
    return out, int(total or 0)
