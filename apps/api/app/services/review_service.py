from __future__ import annotations

import uuid

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db.models import GeneratedArtifact, ReviewTask
from app.services import outbox_service


class ReviewTaskNotFoundError(Exception):
    pass


class ReviewAlreadyProcessedError(Exception):
    pass


def list_reviews(
    db: Session,
    *,
    incident_id: uuid.UUID | None = None,
    status: str | None = None,
    limit: int = 20,
    offset: int = 0,
) -> tuple[list[ReviewTask], int]:
    filters = []
    if incident_id is not None:
        filters.append(ReviewTask.incident_id == incident_id)
    if status is not None:
        filters.append(ReviewTask.status == status)

    total = db.scalar(
        select(func.count()).select_from(ReviewTask).where(*filters)
    )
    rows = db.scalars(
        select(ReviewTask)
        .where(*filters)
        .order_by(ReviewTask.created_at.asc())
        .limit(limit)
        .offset(offset)
    ).all()
    return list(rows), int(total or 0)


def get_review(db: Session, review_task_id: uuid.UUID) -> ReviewTask | None:
    return db.get(ReviewTask, review_task_id)


def _decide(
    db: Session,
    review_task_id: uuid.UUID,
    *,
    decision: str,
    new_review_status: str,
    new_artifact_status: str,
    event_type: str,
    note: str | None,
) -> tuple[ReviewTask, GeneratedArtifact]:
    review = db.get(ReviewTask, review_task_id)
    if review is None:
        raise ReviewTaskNotFoundError()
    if review.status != "pending":
        raise ReviewAlreadyProcessedError()

    artifact = db.get(GeneratedArtifact, review.artifact_id)
    if artifact is None:
        raise ReviewTaskNotFoundError()

    review.status = new_review_status
    review.decision = decision
    review.reviewer_note = note
    review.reviewed_at = func.now()

    artifact.status = new_artifact_status

    db.flush()

    outbox_service.enqueue_event(
        db,
        event_type=event_type,
        aggregate_id=artifact.id,
        payload={
            "review_task_id": str(review.id),
            "artifact_id": str(artifact.id),
            "incident_id": str(artifact.incident_id),
            "decision": decision,
            "note": note,
        },
    )

    db.commit()
    db.refresh(review)
    db.refresh(artifact)
    return review, artifact


def approve_review(
    db: Session, review_task_id: uuid.UUID, note: str | None = None
) -> tuple[ReviewTask, GeneratedArtifact]:
    return _decide(
        db,
        review_task_id,
        decision="approve",
        new_review_status="approved",
        new_artifact_status="approved",
        event_type="artifact.approved",
        note=note,
    )


def reject_review(
    db: Session, review_task_id: uuid.UUID, note: str | None = None
) -> tuple[ReviewTask, GeneratedArtifact]:
    return _decide(
        db,
        review_task_id,
        decision="reject",
        new_review_status="rejected",
        new_artifact_status="rejected",
        event_type="artifact.rejected",
        note=note,
    )
