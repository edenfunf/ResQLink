from __future__ import annotations

import uuid
from datetime import datetime
from enum import Enum

from pydantic import BaseModel, ConfigDict, Field, model_validator


class ReportNeedType(str, Enum):
    # water disasters (barrier lake / flood / typhoon)
    flooding = "flooding"
    mud_removal = "mud_removal"
    road_blocked = "road_blocked"
    power_outage = "power_outage"
    # earthquake / structural
    building_collapse = "building_collapse"
    fire = "fire"
    gas_leak = "gas_leak"
    # cross-disaster
    trapped_person = "trapped_person"
    missing_person = "missing_person"
    medical_need = "medical_need"
    supply_need = "supply_need"
    other = "other"


class ReportSeverity(str, Enum):
    low = "low"
    medium = "medium"
    high = "high"
    critical = "critical"


class ReportStatus(str, Enum):
    new = "new"
    triaged = "triaged"
    in_progress = "in_progress"
    resolved = "resolved"
    archived = "archived"


class VerificationStatus(str, Enum):
    unverified = "unverified"
    verified = "verified"
    rejected = "rejected"


class TriagePriority(str, Enum):
    critical = "critical"
    high = "high"
    normal = "normal"
    low = "low"


class DisasterReportCreate(BaseModel):
    """lat and lon are optional but must be supplied together (else 422)."""

    reporter_name: str | None = Field(default=None, description="通報者姓名（PII）")
    reporter_contact: str | None = Field(
        default=None, description="通報者聯絡方式（PII）"
    )
    need_type: ReportNeedType = Field(..., description="需求類型")
    description: str = Field(..., min_length=1, description="狀況描述（必填）")
    severity: ReportSeverity = Field(
        default=ReportSeverity.medium, description="嚴重程度"
    )
    lat: float | None = Field(default=None, description="緯度（與 lon 必須成對）")
    lon: float | None = Field(default=None, description="經度（與 lat 必須成對）")
    address: str | None = Field(default=None, description="地址或地點描述")

    @model_validator(mode="after")
    def _coords_paired(self) -> DisasterReportCreate:
        if (self.lat is None) != (self.lon is None):
            raise ValueError("lat and lon must be provided together")
        return self

    model_config = {
        "json_schema_extra": {
            "example": {
                "reporter_name": "王先生",
                "reporter_contact": "0912345678",
                "need_type": "mud_removal",
                "description": "住家一樓淤泥約 30 公分，需要協助清理",
                "severity": "high",
                "lat": 23.665,
                "lon": 121.421,
                "address": "花蓮縣光復鄉某路段",
            }
        }
    }


class DisasterReportCreateResponse(BaseModel):
    report_id: uuid.UUID
    status: ReportStatus
    message: str


class VerificationRequest(BaseModel):
    verification_status: VerificationStatus = Field(
        ..., description="查證結果：verified / rejected / unverified"
    )
    note: str | None = Field(default=None, description="查證備註")


class DisasterReportItem(BaseModel):
    """Does not expose reporter_contact (PII)."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    incident_id: uuid.UUID
    reporter_name: str | None = None
    need_type: ReportNeedType
    description: str
    severity: ReportSeverity
    address: str | None = None
    status: ReportStatus
    verification_status: VerificationStatus
    triage_priority: TriagePriority
    created_at: datetime


class DisasterReportDetail(BaseModel):
    """Exposes reporter PII; gate behind permission controls in production."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    incident_id: uuid.UUID
    reporter_name: str | None = None
    reporter_contact: str | None = None
    need_type: ReportNeedType
    description: str
    severity: ReportSeverity
    lat: float | None = None
    lon: float | None = None
    address: str | None = None
    status: ReportStatus
    verification_status: VerificationStatus
    triage_priority: TriagePriority
    raw_payload: dict
    created_at: datetime
    updated_at: datetime


class ReportListResponse(BaseModel):
    items: list[DisasterReportItem]
    total: int
    limit: int
    offset: int
