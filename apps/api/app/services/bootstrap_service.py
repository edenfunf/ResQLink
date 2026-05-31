"""Generate rescue components and review tasks from an incident."""
from __future__ import annotations

import uuid
from collections.abc import Callable

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import GeneratedArtifact, Incident, ReviewTask
from app.services import ai_agent, outbox_service

_SEVERITY_TO_RISK = {
    "low": "low",
    "medium": "medium",
    "high": "high",
    "critical": "high",
}


def _risk_for(artifact_type: str, severity: str) -> str:
    if artifact_type == "public_notice_draft":
        return "high"
    if artifact_type == "map_bundle":
        return "low"
    return _SEVERITY_TO_RISK.get(severity, "medium")


def _review_type_for(artifact_type: str, risk_level: str) -> str:
    if artifact_type == "public_notice_draft":
        return "publication_review"
    if risk_level == "high":
        return "risk_review"
    return "artifact_review"


def _site_title(incident: Incident) -> str:
    if incident.river:
        return f"{incident.river}堰塞湖災害資訊入口"
    return f"{incident.title}資訊入口"


def _gen_microsite_config(incident: Incident) -> dict:
    return {
        "site_title": _site_title(incident),
        "slug": incident.slug,
        "scenario_type": incident.scenario_type,
        "severity": incident.severity,
        "sections": [
            {"key": "notice", "title": "重要公告", "enabled": True},
            {"key": "damage_report", "title": "災情回報", "enabled": True},
            {"key": "volunteer_signup", "title": "志工報名", "enabled": True},
            {"key": "supply_request", "title": "物資需求", "enabled": True},
            {"key": "map", "title": "災情地圖", "enabled": True},
        ],
        "source_refs": incident.source_refs or [],
    }


def _gen_damage_report_form(incident: Incident) -> dict:
    return {
        "form_key": "damage_report",
        "title": "災情回報表單",
        "description": "提供民眾回報淹水、清淤、道路中斷或其他災情需求。",
        "fields": [
            {
                "name": "need_type",
                "label": "需求類型",
                "type": "select",
                "required": True,
                "options": [
                    "flooding",
                    "mud_removal",
                    "road_blocked",
                    "trapped_person",
                    "medical_need",
                    "supply_need",
                    "other",
                ],
            },
            {
                "name": "description",
                "label": "狀況描述",
                "type": "textarea",
                "required": True,
            },
            {
                "name": "address",
                "label": "地址或地點描述",
                "type": "text",
                "required": True,
            },
            {"name": "lat", "label": "緯度", "type": "number", "required": False},
            {"name": "lon", "label": "經度", "type": "number", "required": False},
            {
                "name": "reporter_contact",
                "label": "聯絡方式",
                "type": "text",
                "required": False,
                "pii": True,
            },
        ],
    }


def _gen_volunteer_form(incident: Incident) -> dict:
    return {
        "form_key": "volunteer_signup",
        "title": "志工報名表單",
        "fields": [
            {
                "name": "display_name",
                "label": "姓名或暱稱",
                "type": "text",
                "required": True,
                "pii": True,
            },
            {
                "name": "skills",
                "label": "可協助項目",
                "type": "multi_select",
                "required": True,
                "options": ["清淤", "搬運", "物資整理", "交通接駁", "醫護支援", "行政協助"],
            },
            {
                "name": "available_time",
                "label": "可支援時間",
                "type": "text",
                "required": True,
            },
        ],
    }


def _gen_supply_form(incident: Incident) -> dict:
    return {
        "form_key": "supply_request",
        "title": "物資需求表單",
        "fields": [
            {
                "name": "item_type",
                "label": "物資類型",
                "type": "select",
                "required": True,
                "options": [
                    "飲用水",
                    "乾糧",
                    "清潔用品",
                    "雨鞋",
                    "手套",
                    "鏟子",
                    "藥品",
                    "其他",
                ],
            },
            {
                "name": "quantity",
                "label": "需求數量",
                "type": "number",
                "required": True,
            },
            {
                "name": "delivery_location",
                "label": "配送地點",
                "type": "text",
                "required": True,
            },
        ],
    }


def _gen_map_bundle(incident: Incident) -> dict:
    return {
        "center": {"lat": incident.lat, "lon": incident.lon},
        "zoom": 13,
        "aoi": incident.aoi_geojson,
        "layers": [
            {
                "key": "incident_center",
                "type": "point",
                "title": "事件中心點",
                "enabled": True,
            },
            {
                "key": "aoi",
                "type": "geojson",
                "title": "影響範圍",
                "enabled": True,
            },
            {
                "key": "reports",
                "type": "geojson_endpoint",
                "title": "民眾災情通報",
                "endpoint": f"/v1/incidents/{incident.id}/reports.geojson",
                "enabled": True,
            },
        ],
    }


def _gen_public_notice_draft(incident: Incident) -> dict:
    label = incident.river or incident.title
    return {
        "title": f"{label}堰塞湖災害資訊提醒",
        "body": (
            f"目前系統已建立{_site_title(incident)}。本頁面提供災情回報、志工報名、"
            "物資需求與地圖資訊。所有公開內容須經人工審核後顯示，請民眾仍以政府官方公告為準。"
        ),
        "disclaimer": "本系統為公民科技輔助工具，不取代官方災害應變指揮與公告。",
        "requires_review": True,
    }


_GENERATORS: list[tuple[str, str, Callable[[Incident], dict]]] = [
    ("microsite_config", "救災資訊入口設定", _gen_microsite_config),
    ("damage_report_form", "災情回報表單", _gen_damage_report_form),
    ("volunteer_form", "志工報名表單", _gen_volunteer_form),
    ("supply_form", "物資需求表單", _gen_supply_form),
    ("map_bundle", "災情地圖組合", _gen_map_bundle),
    ("public_notice_draft", "公開公告草稿", _gen_public_notice_draft),
]


class IncidentNotFoundError(Exception):
    pass


def _existing_artifacts(db: Session, incident_id: uuid.UUID) -> list[GeneratedArtifact]:
    return list(
        db.scalars(
            select(GeneratedArtifact)
            .where(GeneratedArtifact.incident_id == incident_id)
            .order_by(GeneratedArtifact.created_at.asc())
        ).all()
    )


def _reviews_for_incident(db: Session, incident_id: uuid.UUID) -> list[ReviewTask]:
    return list(
        db.scalars(
            select(ReviewTask)
            .where(ReviewTask.incident_id == incident_id)
            .order_by(ReviewTask.created_at.asc())
        ).all()
    )


def _apply_ai_texts(artifact_type: str, content: dict, ai_texts: dict) -> bool:
    """Splice AI-drafted free-text into a rule-based content dict. The structure
    stays rule-based; only text fields are replaced. Returns True if applied."""
    if artifact_type == "public_notice_draft" and ai_texts.get("notice"):
        content["title"] = ai_texts["notice"]["title"]
        content["body"] = ai_texts["notice"]["body"]
        return True
    if artifact_type == "microsite_config" and ai_texts.get("site_title"):
        content["site_title"] = ai_texts["site_title"]
        return True
    if artifact_type == "damage_report_form" and ai_texts.get("damage_desc"):
        content["description"] = ai_texts["damage_desc"]
        return True
    return False


def bootstrap_incident(
    db: Session, incident_id: uuid.UUID, use_ai: bool = False
) -> tuple[list[GeneratedArtifact], list[ReviewTask], bool]:
    """Return (artifacts, review_tasks, created). Idempotent: when the incident
    was already bootstrapped, existing rows are returned and created is False.
    With use_ai, free-text fields are drafted by the AI layer (falling back to
    rule-based per field); every artifact still starts as pending_review."""
    incident = db.get(Incident, incident_id)
    if incident is None:
        raise IncidentNotFoundError()

    existing = _existing_artifacts(db, incident_id)
    if existing:
        return existing, _reviews_for_incident(db, incident_id), False

    ai_texts = ai_agent.draft_texts(incident) if use_ai else {}

    artifacts: list[GeneratedArtifact] = []
    review_tasks: list[ReviewTask] = []

    for artifact_type, title, generator in _GENERATORS:
        risk_level = _risk_for(artifact_type, incident.severity)
        content = generator(incident)
        ai_applied = _apply_ai_texts(artifact_type, content, ai_texts)
        artifact = GeneratedArtifact(
            incident_id=incident.id,
            artifact_type=artifact_type,
            title=title,
            content=content,
            status="pending_review",
            risk_level=risk_level,
            created_by="ai_agent" if ai_applied else "system",
        )
        db.add(artifact)
        db.flush()

        review_task = ReviewTask(
            incident_id=incident.id,
            artifact_id=artifact.id,
            review_type=_review_type_for(artifact_type, risk_level),
            risk_level=risk_level,
            status="pending",
        )
        db.add(review_task)

        artifacts.append(artifact)
        review_tasks.append(review_task)

    db.flush()

    outbox_service.enqueue_event(
        db,
        event_type="incident.bootstrapped",
        aggregate_id=incident.id,
        payload={
            "incident_id": str(incident.id),
            "artifact_count": len(artifacts),
            "review_task_count": len(review_tasks),
            "mode": "ai" if ai_texts else "rule",
        },
    )

    db.commit()
    for artifact in artifacts:
        db.refresh(artifact)
    for review_task in review_tasks:
        db.refresh(review_task)

    return artifacts, review_tasks, True
