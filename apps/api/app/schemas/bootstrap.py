from __future__ import annotations

import uuid

from pydantic import BaseModel, ConfigDict

from app.schemas.artifact import ArtifactStatus, ArtifactType, RiskLevel
from app.schemas.review import ReviewStatus


class BootstrapArtifactSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    artifact_type: ArtifactType
    status: ArtifactStatus
    risk_level: RiskLevel


class BootstrapReviewSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    artifact_id: uuid.UUID
    status: ReviewStatus
    risk_level: RiskLevel


class BootstrapResponse(BaseModel):
    incident_id: uuid.UUID
    status: str
    artifacts: list[BootstrapArtifactSummary]
    review_tasks: list[BootstrapReviewSummary]
