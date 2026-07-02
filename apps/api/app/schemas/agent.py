from __future__ import annotations

import uuid

from pydantic import BaseModel, ConfigDict, Field


class AgentPlanRequest(BaseModel):
    message: str = Field(..., min_length=1, description="自然語言的災害需求描述")
    incident_id: uuid.UUID | None = Field(
        default=None, description="已存在的事件 id；省略則由描述建立新事件"
    )


class PlanIncident(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    slug: str
    title: str
    scenario_type: str
    severity: str
    status: str


class ModuleProposal(BaseModel):
    id: str
    name: str
    description: str
    category: str
    category_label: str
    module_type: str
    risk_level: str
    requires_review: bool
    recommended: bool
    reason: str
    already_generated: bool
    implemented: bool = True
    # False for built-in services / roadmap blocks that bootstrap cannot run
    executable: bool = True


class AgentPlanResponse(BaseModel):
    incident: PlanIncident
    intent_mode: str  # ai | heuristic | existing
    ai_enabled: bool
    note: str | None = None
    proposals: list[ModuleProposal]


class AgentExecuteRequest(BaseModel):
    incident_id: uuid.UUID
    module_ids: list[str] = Field(..., min_length=1, description="使用者選定的模組 id")


class ExecuteResult(BaseModel):
    module_id: str
    status: str  # created | skipped | failed
    artifact_id: uuid.UUID | None = None
    review_task_id: uuid.UUID | None = None
    detail: str | None = None


class AgentExecuteResponse(BaseModel):
    incident_id: uuid.UUID
    results: list[ExecuteResult]
    created_count: int
    skipped_count: int
    failed_count: int
