"""Review task query and decision endpoints."""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.schemas.review import (
    ReviewDecisionRequest,
    ReviewDecisionResponse,
    ReviewStatus,
    ReviewTaskItem,
    ReviewTaskListResponse,
)
from app.services import review_service
from app.services.review_service import (
    ReviewAlreadyProcessedError,
    ReviewTaskNotFoundError,
)

router = APIRouter(prefix="/v1/reviews", tags=["reviews"])


@router.get(
    "",
    response_model=ReviewTaskListResponse,
    summary="List review tasks",
)
def list_reviews(
    incident_id: uuid.UUID | None = Query(default=None),
    status_filter: ReviewStatus | None = Query(default=None, alias="status"),
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
) -> ReviewTaskListResponse:
    rows, total = review_service.list_reviews(
        db,
        incident_id=incident_id,
        status=status_filter.value if status_filter else None,
        limit=limit,
        offset=offset,
    )
    return ReviewTaskListResponse(
        items=[ReviewTaskItem.model_validate(row) for row in rows],
        total=total,
        limit=limit,
        offset=offset,
    )


def _handle_decision(
    db: Session,
    review_task_id: uuid.UUID,
    note: str | None,
    *,
    approve: bool,
) -> ReviewDecisionResponse:
    action = review_service.approve_review if approve else review_service.reject_review
    try:
        review, artifact = action(db, review_task_id, note)
    except ReviewTaskNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Review task not found",
        )
    except ReviewAlreadyProcessedError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Review task has already been processed",
        )

    return ReviewDecisionResponse(
        review_task_id=review.id,
        artifact_id=artifact.id,
        status=review.status,
        artifact_status=artifact.status,
    )


@router.post(
    "/{review_task_id}/approve",
    response_model=ReviewDecisionResponse,
    summary="Approve a review task (artifact becomes approved)",
)
def approve_review(
    review_task_id: uuid.UUID,
    body: ReviewDecisionRequest | None = None,
    db: Session = Depends(get_db),
) -> ReviewDecisionResponse:
    note = body.note if body else None
    return _handle_decision(db, review_task_id, note, approve=True)


@router.post(
    "/{review_task_id}/reject",
    response_model=ReviewDecisionResponse,
    summary="Reject a review task (artifact becomes rejected)",
)
def reject_review(
    review_task_id: uuid.UUID,
    body: ReviewDecisionRequest | None = None,
    db: Session = Depends(get_db),
) -> ReviewDecisionResponse:
    note = body.note if body else None
    return _handle_decision(db, review_task_id, note, approve=False)
