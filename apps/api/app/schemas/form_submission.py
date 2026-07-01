from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class FormSubmissionCreate(BaseModel):
    payload: dict = Field(
        ..., description="依表單 fields 定義的作答內容（鍵為欄位 name）"
    )


class FormSubmissionCreateResponse(BaseModel):
    submission_id: uuid.UUID
    message: str


class FormSubmissionItem(BaseModel):
    id: uuid.UUID
    artifact_id: uuid.UUID
    form_key: str
    payload: dict  # PII fields masked
    created_at: datetime


class FormSubmissionListResponse(BaseModel):
    items: list[FormSubmissionItem]
    total: int
    limit: int
    offset: int
