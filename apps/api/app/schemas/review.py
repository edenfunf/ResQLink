from __future__ import annotations

import uuid
from datetime import datetime
from enum import Enum

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.artifact import ArtifactStatus, RiskLevel


class ReviewType(str, Enum):
    artifact_review = "artifact_review"
    risk_review = "risk_review"
    publication_review = "publication_review"


class ReviewStatus(str, Enum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"


class ReviewDecision(str, Enum):
    approve = "approve"
    reject = "reject"


class ReviewTaskItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    incident_id: uuid.UUID
    artifact_id: uuid.UUID
    review_type: ReviewType
    status: ReviewStatus
    risk_level: RiskLevel
    decision: ReviewDecision | None = None
    created_at: datetime


class ReviewTaskDetail(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    incident_id: uuid.UUID
    artifact_id: uuid.UUID
    review_type: ReviewType
    status: ReviewStatus
    risk_level: RiskLevel
    reviewer_note: str | None = None
    decision: ReviewDecision | None = None
    created_at: datetime
    reviewed_at: datetime | None = None


class ReviewTaskListResponse(BaseModel):
    items: list[ReviewTaskItem]
    total: int
    limit: int
    offset: int


class ReviewDecisionRequest(BaseModel):
    note: str | None = Field(default=None, description="審核備註")


class ReviewDecisionResponse(BaseModel):
    review_task_id: uuid.UUID
    artifact_id: uuid.UUID
    status: ReviewStatus
    artifact_status: ArtifactStatus
