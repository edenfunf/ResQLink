from __future__ import annotations

from pydantic import BaseModel, Field


class ConnectorItem(BaseModel):
    id: str
    name: str
    source_type: str  # alert | dataset
    description: str
    homepage: str
    has_sample: bool
    live_enabled: bool


class ConnectorListResponse(BaseModel):
    items: list[ConnectorItem]


class IngestRequest(BaseModel):
    payload: dict = Field(..., description="來源原生回應（CWA / CAP JSON）")


class IngestResult(BaseModel):
    created: list[str]
    created_count: int
    skipped: int
    failed: int
