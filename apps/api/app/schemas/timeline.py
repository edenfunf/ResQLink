from __future__ import annotations

import uuid

from pydantic import BaseModel


class TimelineItem(BaseModel):
    event_type: str
    label: str
    summary: str
    at: str


class TimelineResponse(BaseModel):
    incident_id: uuid.UUID
    items: list[TimelineItem]
    total: int
    limit: int
    offset: int
