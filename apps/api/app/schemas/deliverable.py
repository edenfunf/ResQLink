from __future__ import annotations

import uuid

from pydantic import BaseModel, Field


class DeliverableLink(BaseModel):
    label: str
    url: str = Field(description="已解析為此事件的相對前端路徑")
    kind: str = Field(description="internal | external_pending")


class DeliverableMember(BaseModel):
    artifact_type: str
    name: str
    present: bool = Field(description="此事件是否已生成該成員模組")
    artifact_id: uuid.UUID | None = None
    status: str | None = Field(default=None, description="artifact 狀態（未生成為 null）")


class DeliverableItem(BaseModel):
    key: str
    name: str
    tagline: str
    accent: str
    icon: str
    status: str = Field(description="empty | draft | in_review | ready")
    member_total: int
    generated_count: int
    approved_count: int
    pending_count: int
    front: DeliverableLink
    admin: DeliverableLink
    members: list[DeliverableMember]


class DeliverablesResponse(BaseModel):
    incident_id: uuid.UUID
    slug: str
    items: list[DeliverableItem]
