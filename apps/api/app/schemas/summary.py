from __future__ import annotations

import uuid

from pydantic import BaseModel, Field


class CountByKey(BaseModel):
    key: str
    count: int


class ArtifactsSummary(BaseModel):
    total: int
    pending_review: int
    approved: int
    rejected: int
    archived: int


class ReviewsSummary(BaseModel):
    total: int
    pending: int
    approved: int
    rejected: int


class ReportsSummary(BaseModel):
    total: int
    geolocated: int = Field(description="lat/lon 皆有、可上圖的通報數")
    critical_open: int = Field(
        default=0, description="triage 為 critical 且尚未結案的通報數"
    )
    by_need_type: list[CountByKey]
    by_severity: list[CountByKey]
    by_triage_priority: list[CountByKey] = Field(default_factory=list)


class ReadinessSummary(BaseModel):
    bootstrapped: bool = Field(description="是否已生成救災元件")
    has_public_content: bool = Field(description="是否已有審核通過、可公開的元件")
    has_reports: bool = Field(description="是否已有民眾通報")


class IncidentSummary(BaseModel):
    incident_id: uuid.UUID
    slug: str
    title: str
    severity: str
    status: str
    artifacts: ArtifactsSummary
    reviews: ReviewsSummary
    reports: ReportsSummary
    readiness: ReadinessSummary
