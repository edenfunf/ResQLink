"""Open-data connector endpoints — turn official open data into incidents."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.schemas.connector import (
    ConnectorItem,
    ConnectorListResponse,
    IngestRequest,
    IngestResult,
)
from app.services import connector_service
from app.services.connector_service import (
    LiveDisabledError,
    NotAnAlertConnectorError,
    UnknownConnectorError,
)

router = APIRouter(prefix="/v1/connectors", tags=["connectors"])


@router.get("", response_model=ConnectorListResponse, summary="List open-data connectors")
def list_connectors() -> ConnectorListResponse:
    return ConnectorListResponse(
        items=[ConnectorItem(**c) for c in connector_service.list_connectors()]
    )


@router.post(
    "/{source}/ingest",
    response_model=IngestResult,
    summary="Map a provided source payload into incidents",
)
def ingest(source: str, body: IngestRequest, db: Session = Depends(get_db)) -> IngestResult:
    try:
        return IngestResult(**connector_service.ingest(db, source, body.payload))
    except UnknownConnectorError:
        raise HTTPException(status_code=404, detail="Unknown connector")
    except NotAnAlertConnectorError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.post(
    "/{source}/demo",
    response_model=IngestResult,
    summary="Ingest the connector's built-in sample payload (no key needed)",
)
def ingest_demo(source: str, db: Session = Depends(get_db)) -> IngestResult:
    try:
        return IngestResult(**connector_service.ingest_demo(db, source))
    except UnknownConnectorError:
        raise HTTPException(status_code=404, detail="Unknown connector")
    except NotAnAlertConnectorError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.post(
    "/{source}/sync",
    response_model=IngestResult,
    summary="Live-fetch from the source and ingest (needs credentials)",
)
def sync(source: str, db: Session = Depends(get_db)) -> IngestResult:
    try:
        return IngestResult(**connector_service.sync(db, source))
    except UnknownConnectorError:
        raise HTTPException(status_code=404, detail="Unknown connector")
    except NotAnAlertConnectorError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except LiveDisabledError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
