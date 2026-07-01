"""Open-data connector orchestration.

Maps a source payload (live-fetched or provided) into standard alerts and creates
incidents through the normal pipeline. Idempotent by ``source_ref`` so re-syncing
the same official alert never duplicates an incident.
"""
from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.connectors import cwa, ncdr
from app.db.models import Incident
from app.schemas.alert import AlertEventCreate
from app.services import incident_service


class UnknownConnectorError(Exception):
    def __init__(self, source: str) -> None:
        super().__init__(f"Unknown connector: {source}")
        self.source = source


class NotAnAlertConnectorError(Exception):
    def __init__(self, source: str) -> None:
        super().__init__(f"Connector '{source}' does not create incidents.")
        self.source = source


class LiveDisabledError(Exception):
    def __init__(self, source: str, detail: str) -> None:
        super().__init__(detail)
        self.source = source


@dataclass(frozen=True)
class ConnectorDef:
    id: str
    name: str
    source_type: str  # "alert" | "dataset"
    description: str
    homepage: str
    mapper: Callable[[dict], list[dict]] | None = None
    fetcher: Callable[[], list[dict]] | None = None
    sample: dict | None = None
    live_enabled: Callable[[], bool] | None = None


CONNECTORS: dict[str, ConnectorDef] = {
    "cwa_earthquake": ConnectorDef(
        id="cwa_earthquake",
        name="中央氣象署 — 顯著有感地震報告",
        source_type="alert",
        description="把 CWA 地震報告轉成地震事件（依規模判定嚴重度）。",
        homepage="https://opendata.cwa.gov.tw/",
        mapper=cwa.map_earthquake,
        fetcher=cwa.fetch_earthquake,
        sample=cwa.SAMPLE_EARTHQUAKE,
        live_enabled=cwa.is_live_enabled,
    ),
    "ncdr_cap": ConnectorDef(
        id="ncdr_cap",
        name="NCDR — 災害示警 (CAP)",
        source_type="alert",
        description="把 NCDR CAP 示警（颱風／大雨／土石流等）轉成對應災別事件。",
        homepage="https://alerts.ncdr.nat.gov.tw/",
        mapper=ncdr.map_cap,
        fetcher=ncdr.fetch_cap,
        sample=ncdr.SAMPLE_CAP,
        live_enabled=lambda: False,
    ),
    "data_gov_tw": ConnectorDef(
        id="data_gov_tw",
        name="政府資料開放平臺 data.gov.tw",
        source_type="dataset",
        description="資料集來源（避難所、地理圖資等加值用），非事件警報來源。",
        homepage="https://data.gov.tw/",
    ),
}


def list_connectors() -> list[dict]:
    out = []
    for c in CONNECTORS.values():
        out.append(
            {
                "id": c.id,
                "name": c.name,
                "source_type": c.source_type,
                "description": c.description,
                "homepage": c.homepage,
                "has_sample": c.sample is not None,
                "live_enabled": bool(c.live_enabled and c.live_enabled()),
            }
        )
    return out


def _source_ref(alert: dict) -> str | None:
    refs = alert.get("source_refs") or []
    return refs[0].get("source_ref") if refs else None


def _exists(db: Session, source_ref: str) -> bool:
    return (
        db.scalar(
            select(Incident.id).where(
                Incident.source_refs.op("@>")([{"source_ref": source_ref}])
            )
        )
        is not None
    )


def _create_from_alerts(db: Session, alerts: list[dict]) -> dict:
    created: list[str] = []
    skipped = failed = 0
    for alert in alerts:
        ref = _source_ref(alert)
        if ref and _exists(db, ref):
            skipped += 1
            continue
        try:
            payload = AlertEventCreate(**alert)
            incident = incident_service.create_incident_from_alert(db, payload)
            created.append(str(incident.id))
        except Exception:  # ValidationError or DB error — isolate per record
            db.rollback()
            failed += 1
    return {"created": created, "created_count": len(created), "skipped": skipped, "failed": failed}


def _require(source: str) -> ConnectorDef:
    cdef = CONNECTORS.get(source)
    if cdef is None:
        raise UnknownConnectorError(source)
    return cdef


def ingest(db: Session, source: str, payload: dict) -> dict:
    cdef = _require(source)
    if cdef.mapper is None:
        raise NotAnAlertConnectorError(source)
    return _create_from_alerts(db, cdef.mapper(payload))


def ingest_demo(db: Session, source: str) -> dict:
    cdef = _require(source)
    if cdef.mapper is None or cdef.sample is None:
        raise NotAnAlertConnectorError(source)
    return _create_from_alerts(db, cdef.mapper(cdef.sample))


def sync(db: Session, source: str) -> dict:
    cdef = _require(source)
    if cdef.mapper is None or cdef.fetcher is None:
        raise NotAnAlertConnectorError(source)
    if not (cdef.live_enabled and cdef.live_enabled()):
        raise LiveDisabledError(
            source,
            f"Live fetch for '{source}' is not configured "
            f"(set credentials / endpoint). 改用 ingest/demo 以提供的 payload 建立事件。",
        )
    return _create_from_alerts(db, cdef.fetcher())
