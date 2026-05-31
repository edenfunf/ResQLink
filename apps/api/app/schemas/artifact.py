from __future__ import annotations

import uuid
from datetime import datetime
from enum import Enum

from pydantic import BaseModel, ConfigDict


class ArtifactType(str, Enum):
    microsite_config = "microsite_config"
    damage_report_form = "damage_report_form"
    volunteer_form = "volunteer_form"
    supply_form = "supply_form"
    map_bundle = "map_bundle"
    public_notice_draft = "public_notice_draft"


class ArtifactStatus(str, Enum):
    pending_review = "pending_review"
    approved = "approved"
    rejected = "rejected"
    archived = "archived"


class RiskLevel(str, Enum):
    low = "low"
    medium = "medium"
    high = "high"


class GeneratedArtifactItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    incident_id: uuid.UUID
    artifact_type: ArtifactType
    title: str | None = None
    status: ArtifactStatus
    risk_level: RiskLevel
    created_by: str
    created_at: datetime


class GeneratedArtifactDetail(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    incident_id: uuid.UUID
    artifact_type: ArtifactType
    title: str | None = None
    content: dict
    status: ArtifactStatus
    risk_level: RiskLevel
    created_by: str
    created_at: datetime
    updated_at: datetime


class GeneratedArtifactListResponse(BaseModel):
    items: list[GeneratedArtifactItem]
    total: int
    limit: int
    offset: int
