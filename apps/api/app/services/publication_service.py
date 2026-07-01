"""Publish approved artifacts to external channels.

Two real connectors plus a Google Forms builder sit behind this service. When a
channel's credentials are configured (see ``app.connectors.*.is_configured``) the
real API is called; otherwise it falls back to a SIMULATED result that records the
act without any external call. Either way publishing is gated on the artifact
being ``approved`` — the agent/automation can never push unreviewed content out,
preserving the review gate.
"""
from __future__ import annotations

import uuid

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.connectors import facebook, google_forms, line
from app.connectors.base import ConnectorError
from app.core.config import settings
from app.db.models import GeneratedArtifact, Incident, Publication
from app.services import outbox_service

# artifact_type -> default external channel
_CHANNEL_BY_TYPE: dict[str, str] = {
    "fb_page_post": "facebook",
    "line_broadcast": "line",
    "press_release": "facebook",
    "public_notice_draft": "facebook",
    "clarification_notice": "facebook",
    "volunteer_recruit_post": "facebook",
}
_VALID_CHANNELS = {"facebook", "line"}


class ArtifactNotFoundError(Exception):
    pass


class ArtifactNotApprovedError(Exception):
    pass


class ArtifactNotPublishableError(Exception):
    pass


# ── content → message helpers ─────────────────────────────────────────────
def _public_link(db: Session, artifact: GeneratedArtifact) -> str | None:
    incident = db.get(Incident, artifact.incident_id)
    if incident is None:
        return None
    base = settings.WEB_PUBLIC_BASE_URL.rstrip("/")
    return f"{base}/preview/{incident.slug}"


def _fb_message(content: dict) -> str:
    parts: list[str] = []
    title = content.get("title") or content.get("headline")
    if title:
        parts.append(str(title))
    body = content.get("body")
    if not body and isinstance(content.get("body_paragraphs"), list):
        body = "\n\n".join(str(p) for p in content["body_paragraphs"])
    if body:
        parts.append(str(body))
    hashtags = content.get("hashtags")
    if isinstance(hashtags, list) and hashtags:
        parts.append(" ".join(str(h) for h in hashtags))
    return "\n\n".join(parts) or "（無內文）"


def _line_message(content: dict) -> tuple[str, list[str]]:
    text = content.get("text") or content.get("body") or content.get("title") or "（無內文）"
    quick = content.get("quick_replies")
    quick_list = [str(q) for q in quick] if isinstance(quick, list) else []
    return str(text), quick_list


def _simulated(channel: str, artifact: GeneratedArtifact) -> dict:
    """Stand-in connector — records the act, makes no external call."""
    ref = f"sim-{channel}-{artifact.id.hex[:12]}"
    return {
        "connector": "simulated",
        "status": "published",
        "external_ref": ref,
        "url": None,
        "detail": "模擬連接器：已記錄動作，未實際對外。設定該管道憑證後即走真實 API。",
    }


def _record(
    db: Session,
    *,
    artifact: GeneratedArtifact,
    channel: str,
    result: dict,
    event_type: str = "artifact.published",
) -> Publication:
    publication = Publication(
        incident_id=artifact.incident_id,
        artifact_id=artifact.id,
        channel=channel,
        connector=result["connector"],
        status=result["status"],
        external_ref=result.get("external_ref"),
        url=result.get("url"),
        detail=result.get("detail"),
    )
    db.add(publication)
    db.flush()
    outbox_service.enqueue_event(
        db,
        event_type=event_type,
        aggregate_id=artifact.id,
        payload={
            "incident_id": str(artifact.incident_id),
            "artifact_id": str(artifact.id),
            "channel": channel,
            "connector": result["connector"],
        },
    )
    db.commit()
    db.refresh(publication)
    return publication


# ── publish (facebook / line) ─────────────────────────────────────────────
def publish(
    db: Session, artifact_id: uuid.UUID, channel: str | None = None
) -> Publication:
    artifact = db.get(GeneratedArtifact, artifact_id)
    if artifact is None:
        raise ArtifactNotFoundError()
    if artifact.status != "approved":
        raise ArtifactNotApprovedError()

    resolved = channel or _CHANNEL_BY_TYPE.get(artifact.artifact_type)
    if resolved is None or resolved not in _VALID_CHANNELS:
        raise ArtifactNotPublishableError()

    content = artifact.content or {}
    if resolved == "facebook":
        if facebook.is_configured():
            result = facebook.publish_post(
                message=_fb_message(content), link=_public_link(db, artifact)
            )
        else:
            result = _simulated(resolved, artifact)
    else:  # line
        text, quick = _line_message(content)
        if line.is_configured():
            result = line.broadcast(text=text, quick_replies=quick)
        else:
            result = _simulated(resolved, artifact)

    return _record(db, artifact=artifact, channel=resolved, result=result)


# ── Google Forms (real 0→1 form creation) ─────────────────────────────────
def export_google_form(db: Session, artifact_id: uuid.UUID) -> Publication:
    artifact = db.get(GeneratedArtifact, artifact_id)
    if artifact is None:
        raise ArtifactNotFoundError()
    if artifact.status != "approved":
        raise ArtifactNotApprovedError()

    content = artifact.content or {}
    fields = content.get("fields")
    if not isinstance(fields, list) or not fields:
        raise ArtifactNotPublishableError()

    title = str(content.get("title") or artifact.title or "救災表單")
    description = content.get("description") or content.get("notice")

    if google_forms.is_configured():
        result = google_forms.create_form(
            title=title, description=description, fields=fields
        )
    else:
        result = {
            "connector": "simulated",
            "status": "published",
            "external_ref": f"sim-google_form-{artifact.id.hex[:12]}",
            "url": None,
            "detail": "模擬連接器：未實際建立 Google 表單。設定 GOOGLE_SERVICE_ACCOUNT_FILE 後即真實建立。",
        }

    return _record(db, artifact=artifact, channel="google_form", result=result)


def list_publications(
    db: Session, incident_id: uuid.UUID, *, limit: int = 50, offset: int = 0
) -> tuple[list[Publication], int]:
    rows = db.scalars(
        select(Publication)
        .where(Publication.incident_id == incident_id)
        .order_by(Publication.created_at.desc())
        .limit(limit)
        .offset(offset)
    ).all()
    total = db.scalar(
        select(func.count())
        .select_from(Publication)
        .where(Publication.incident_id == incident_id)
    )
    return list(rows), int(total or 0)


__all__ = [
    "ArtifactNotApprovedError",
    "ArtifactNotFoundError",
    "ArtifactNotPublishableError",
    "ConnectorError",
    "export_google_form",
    "list_publications",
    "publish",
]
