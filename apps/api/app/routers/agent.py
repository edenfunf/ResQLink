"""Conversational orchestrator endpoints.

``/plan`` understands a request and proposes modules (no side effects beyond
standardising an incident); ``/execute`` runs the human-selected modules. The
split keeps a confirmation step between understanding and building.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.schemas.agent import (
    AgentExecuteRequest,
    AgentExecuteResponse,
    AgentPlanRequest,
    AgentPlanResponse,
    ExecuteResult,
    ModuleProposal,
    PlanIncident,
)
from app.services import agent_orchestrator
from app.services.agent_orchestrator import IncidentNotFoundError

router = APIRouter(prefix="/v1/agent", tags=["agent"])


@router.post(
    "/plan",
    response_model=AgentPlanResponse,
    summary="Understand a request and propose rescue modules",
)
def plan(
    payload: AgentPlanRequest,
    db: Session = Depends(get_db),
) -> AgentPlanResponse:
    try:
        result = agent_orchestrator.plan(
            db, payload.message, incident_id=payload.incident_id
        )
    except IncidentNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Incident not found",
        )
    return AgentPlanResponse(
        incident=PlanIncident.model_validate(result["incident"]),
        intent_mode=result["intent_mode"],
        ai_enabled=result["ai_enabled"],
        note=result["note"],
        proposals=[ModuleProposal(**p) for p in result["proposals"]],
    )


@router.post(
    "/execute",
    response_model=AgentExecuteResponse,
    summary="Generate the selected modules (each isolated, all reviewable)",
)
def execute(
    payload: AgentExecuteRequest,
    db: Session = Depends(get_db),
) -> AgentExecuteResponse:
    try:
        result = agent_orchestrator.execute(
            db, payload.incident_id, payload.module_ids
        )
    except IncidentNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Incident not found",
        )
    return AgentExecuteResponse(
        incident_id=result["incident_id"],
        results=[ExecuteResult(**r) for r in result["results"]],
        created_count=result["created_count"],
        skipped_count=result["skipped_count"],
        failed_count=result["failed_count"],
    )
