from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.alert import LocationInput, SourceRefInput


class IncidentCreateResponse(BaseModel):
    incident_id: uuid.UUID
    slug: str
    status: str = Field(description="建立結果狀態，例如 created")
    next: str = Field(description="後續可呼叫的資源路徑")


class IncidentListItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    slug: str
    title: str
    scenario_type: str
    severity: str
    county: str | None = None
    town: str | None = None
    river: str | None = None
    status: str
    created_at: datetime


class IncidentListResponse(BaseModel):
    items: list[IncidentListItem]
    total: int
    limit: int
    offset: int


class IncidentDetail(BaseModel):
    id: uuid.UUID
    slug: str
    title: str
    scenario_type: str
    severity: str
    location: LocationInput
    aoi: dict | None = None
    status: str
    source_refs: list[SourceRefInput] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime


class OutboxEventItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    event_type: str
    aggregate_id: uuid.UUID | None = None
    payload: dict
    processed: bool
    created_at: datetime


class OutboxListResponse(BaseModel):
    items: list[OutboxEventItem]
