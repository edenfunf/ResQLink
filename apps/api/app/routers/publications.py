"""Publish approved outreach artifacts to external channels (simulated connector)."""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.schemas.publication import (
    PublicationItem,
    PublicationListResponse,
    PublishRequest,
)
from app.services import publication_service
from app.services.publication_service import (
    ArtifactNotApprovedError,
    ArtifactNotFoundError,
    ArtifactNotPublishableError,
    ConnectorError,
)

router = APIRouter(prefix="/v1", tags=["publications"])


@router.post(
    "/artifacts/{artifact_id}/publish",
    response_model=PublicationItem,
    status_code=status.HTTP_201_CREATED,
    summary="Publish an approved outreach artifact (real connector, else simulated)",
)
def publish_artifact(
    artifact_id: uuid.UUID,
    payload: PublishRequest | None = None,
    db: Session = Depends(get_db),
) -> PublicationItem:
    channel = payload.channel.value if payload and payload.channel else None
    try:
        publication = publication_service.publish(db, artifact_id, channel=channel)
    except ArtifactNotFoundError:
        raise HTTPException(status_code=404, detail="Artifact not found")
    except ArtifactNotApprovedError:
        raise HTTPException(
            status_code=400,
            detail="Artifact must be approved before publishing",
        )
    except ArtifactNotPublishableError:
        raise HTTPException(
            status_code=400,
            detail="This artifact type is not publishable to an external channel",
        )
    except ConnectorError as exc:
        raise HTTPException(status_code=502, detail=exc.reason)
    return PublicationItem.model_validate(publication)


@router.post(
    "/artifacts/{artifact_id}/google-form",
    response_model=PublicationItem,
    status_code=status.HTTP_201_CREATED,
    summary="Build a real Google Form from an approved form artifact (else simulated)",
)
def export_google_form(
    artifact_id: uuid.UUID,
    db: Session = Depends(get_db),
) -> PublicationItem:
    try:
        publication = publication_service.export_google_form(db, artifact_id)
    except ArtifactNotFoundError:
        raise HTTPException(status_code=404, detail="Artifact not found")
    except ArtifactNotApprovedError:
        raise HTTPException(
            status_code=400,
            detail="Artifact must be approved before exporting",
        )
    except ArtifactNotPublishableError:
        raise HTTPException(
            status_code=400,
            detail="This artifact is not a form (no fields to build a Google Form)",
        )
    except ConnectorError as exc:
        raise HTTPException(status_code=502, detail=exc.reason)
    return PublicationItem.model_validate(publication)


@router.get(
    "/incidents/{incident_id}/publications",
    response_model=PublicationListResponse,
    summary="List publications for an incident",
)
def list_publications(
    incident_id: uuid.UUID,
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
) -> PublicationListResponse:
    rows, total = publication_service.list_publications(
        db, incident_id, limit=limit, offset=offset
    )
    return PublicationListResponse(
        items=[PublicationItem.model_validate(r) for r in rows],
        total=total,
        limit=limit,
        offset=offset,
    )
