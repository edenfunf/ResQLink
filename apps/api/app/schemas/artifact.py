from __future__ import annotations

import uuid
from datetime import datetime
from enum import Enum

from pydantic import BaseModel, ConfigDict


class ArtifactType(str, Enum):
    # core (default-enabled) modules
    microsite_config = "microsite_config"
    damage_report_form = "damage_report_form"
    volunteer_form = "volunteer_form"
    supply_form = "supply_form"
    map_bundle = "map_bundle"
    public_notice_draft = "public_notice_draft"
    # extended generator modules
    evacuation_guide = "evacuation_guide"
    faq = "faq"
    sos_form = "sos_form"
    medical_need_form = "medical_need_form"
    vulnerable_care_list = "vulnerable_care_list"
    fb_page_post = "fb_page_post"
    line_broadcast = "line_broadcast"
    press_release = "press_release"
    volunteer_recruit_post = "volunteer_recruit_post"
    volunteer_checkin = "volunteer_checkin"
    supply_donation_form = "supply_donation_form"
    supply_dashboard = "supply_dashboard"
    shelter_map = "shelter_map"
    hazard_zone_layer = "hazard_zone_layer"
    clarification_notice = "clarification_notice"


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
