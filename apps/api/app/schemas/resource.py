from __future__ import annotations

import uuid
from datetime import datetime
from enum import Enum

from pydantic import BaseModel, ConfigDict, Field, model_validator


class OfferType(str, Enum):
    volunteer = "volunteer"
    supply = "supply"


class OfferStatus(str, Enum):
    open = "open"
    matched = "matched"
    closed = "closed"


class ResourceOfferCreate(BaseModel):
    """lat/lon optional but must be supplied together (else 422)."""

    offer_type: OfferType = Field(..., description="資源類型：志工或物資")
    item: str = Field(..., min_length=1, description="可協助項目 / 物資品項")
    quantity: int | None = Field(default=None, ge=1, description="數量（物資/人數）")
    provider_name: str | None = Field(default=None, description="提供者名稱（PII）")
    provider_contact: str | None = Field(default=None, description="聯絡方式（PII）")
    lat: float | None = Field(default=None, description="緯度（與 lon 成對）")
    lon: float | None = Field(default=None, description="經度（與 lat 成對）")
    address: str | None = Field(default=None, description="地點")
    available_time: str | None = Field(default=None, description="可支援時間")

    @model_validator(mode="after")
    def _coords_paired(self) -> "ResourceOfferCreate":
        if (self.lat is None) != (self.lon is None):
            raise ValueError("lat and lon must be provided together")
        return self


class ResourceOfferCreateResponse(BaseModel):
    offer_id: uuid.UUID
    status: OfferStatus
    message: str


class ResourceOfferItem(BaseModel):
    """Does not expose provider_contact (PII)."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    incident_id: uuid.UUID
    offer_type: OfferType
    item: str
    quantity: int | None = None
    provider_name: str | None = None
    lat: float | None = None
    lon: float | None = None
    address: str | None = None
    available_time: str | None = None
    status: OfferStatus
    created_at: datetime


class ResourceOfferListResponse(BaseModel):
    items: list[ResourceOfferItem]
    total: int
    limit: int
    offset: int


# ── matching read-model ────────────────────────────────────────
class MatchCandidate(BaseModel):
    offer_id: uuid.UUID
    offer_type: OfferType
    item: str
    quantity: int | None = None
    address: str | None = None
    distance_km: float | None = None
    score: float


class MatchForReport(BaseModel):
    report_id: uuid.UUID
    need_type: str
    triage_priority: str
    description: str
    address: str | None = None
    candidates: list[MatchCandidate]


class MatchesResponse(BaseModel):
    incident_id: uuid.UUID
    matched_reports: int = Field(description="有候選資源的開放通報數（全部，不受分頁影響）")
    unmatched_reports: int = Field(description="找不到候選資源的開放通報數（全部）")
    open_offers: int
    total_reports: int = Field(description="開放通報總數")
    limit: int
    offset: int
    items: list[MatchForReport]
