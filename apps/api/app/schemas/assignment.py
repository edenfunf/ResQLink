from __future__ import annotations

import uuid
from datetime import datetime
from enum import Enum

from pydantic import BaseModel, ConfigDict, Field


class AssignmentStatus(str, Enum):
    assigned = "assigned"
    in_progress = "in_progress"
    done = "done"
    cancelled = "cancelled"


class AssignmentCreate(BaseModel):
    report_id: uuid.UUID = Field(..., description="要處理的通報（需求）")
    offer_id: uuid.UUID = Field(..., description="派遣的資源（志工/物資）")
    note: str | None = Field(default=None, description="派工備註")


class AssignmentUpdate(BaseModel):
    status: AssignmentStatus
    note: str | None = None


class AssignmentItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    incident_id: uuid.UUID
    report_id: uuid.UUID
    offer_id: uuid.UUID
    status: AssignmentStatus
    note: str | None = None
    created_at: datetime
    updated_at: datetime


class AssignmentListResponse(BaseModel):
    items: list[AssignmentItem]
    total: int
    limit: int
    offset: int
