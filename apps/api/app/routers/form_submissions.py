"""Generic form submission endpoints — make any approved generated form live."""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.schemas.form_submission import (
    FormSubmissionCreate,
    FormSubmissionCreateResponse,
    FormSubmissionItem,
    FormSubmissionListResponse,
)
from app.services import form_service
from app.services.form_service import (
    FormNotApprovedError,
    FormNotFoundError,
    MissingFieldError,
    NotAFormError,
)

router = APIRouter(prefix="/v1/artifacts", tags=["forms"])


@router.post(
    "/{artifact_id}/submissions",
    response_model=FormSubmissionCreateResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Submit an approved generated form",
)
def submit_form(
    artifact_id: uuid.UUID,
    payload: FormSubmissionCreate,
    db: Session = Depends(get_db),
) -> FormSubmissionCreateResponse:
    try:
        submission = form_service.submit(db, artifact_id, payload.payload)
    except FormNotFoundError:
        raise HTTPException(status_code=404, detail="Form artifact not found")
    except NotAFormError:
        raise HTTPException(
            status_code=400, detail="This artifact is not a submittable form"
        )
    except FormNotApprovedError:
        raise HTTPException(
            status_code=400, detail="Form must be approved before it accepts submissions"
        )
    except MissingFieldError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return FormSubmissionCreateResponse(
        submission_id=submission.id, message="已送出，感謝您的回報"
    )


@router.get(
    "/{artifact_id}/submissions",
    response_model=FormSubmissionListResponse,
    summary="List submissions for a form (PII masked)",
)
def list_form_submissions(
    artifact_id: uuid.UUID,
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
) -> FormSubmissionListResponse:
    result = form_service.list_submissions(db, artifact_id, limit=limit, offset=offset)
    if result is None:
        raise HTTPException(
            status_code=404, detail="Form artifact not found"
        )
    rows, total = result
    return FormSubmissionListResponse(
        items=[FormSubmissionItem(**r) for r in rows],
        total=total,
        limit=limit,
        offset=offset,
    )
