"""Public-facing: approved artifacts and incident basics only, never PII."""
from __future__ import annotations

import uuid

from pydantic import BaseModel, ConfigDict

from app.schemas.alert import LocationInput
from app.schemas.artifact import ArtifactType, RiskLevel


class PublicIncidentInfo(BaseModel):
    id: uuid.UUID
    slug: str
    title: str
    scenario_type: str
    severity: str
    location: LocationInput
    status: str


class PublicArtifactItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    artifact_type: ArtifactType
    title: str | None = None
    content: dict
    risk_level: RiskLevel


class PublicEndpoints(BaseModel):
    reports_geojson: str
    submit_report: str


class PublicPreviewResponse(BaseModel):
    incident: PublicIncidentInfo
    artifacts: list[PublicArtifactItem]
    public_endpoints: PublicEndpoints
