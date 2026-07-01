from __future__ import annotations

import uuid
from datetime import datetime
from enum import Enum

from pydantic import BaseModel, ConfigDict, Field


class Channel(str, Enum):
    facebook = "facebook"
    line = "line"


class PublishRequest(BaseModel):
    channel: Channel | None = Field(
        default=None, description="發布管道；省略則依 artifact_type 自動判定"
    )


class PublicationItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    incident_id: uuid.UUID
    artifact_id: uuid.UUID
    channel: str
    connector: str
    status: str
    external_ref: str | None = None
    url: str | None = None
    detail: str | None = None
    created_at: datetime


class PublicationListResponse(BaseModel):
    items: list[PublicationItem]
    total: int
    limit: int
    offset: int
