"""Demo helper: populate an incident with fake citizen reports and
supply/volunteer offers so the public rescue site looks alive. Gated by
settings.DEMO_AUTO_APPROVE; idempotent (no-op if the incident already has
reports)."""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.services import demo_seed_service

router = APIRouter(prefix="/v1/incidents", tags=["demo"])


@router.post(
    "/{incident_id}/demo-activity",
    summary="Seed demo reports + resource offers for an incident (demo mode only)",
)
def seed_demo_activity(
    incident_id: uuid.UUID,
    force: bool = False,
    db: Session = Depends(get_db),
) -> dict:
    return demo_seed_service.seed_incident_activity(db, incident_id, force=force)
