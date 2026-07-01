"""Incident timeline (module: coordination_timeline).

A read-model built entirely from event_outbox — no extra table. Because every
domain change is written to the outbox in the same transaction as its business
data, the timeline is a faithful, audit-grade history of the incident.
"""
from __future__ import annotations

import uuid

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db.models import EventOutbox

_LABELS: dict[str, str] = {
    "incident.created": "事件建立",
    "incident.bootstrapped": "生成救災元件",
    "artifact.approved": "元件審核通過",
    "artifact.rejected": "元件審核退回",
    "disaster_report.created": "民眾通報",
    "agent.planned": "Agent 規劃提案",
    "agent.executed": "Agent 生成模組",
    "resource_offer.created": "資源登記（志工/物資）",
    "assignment.created": "派工指派",
    "assignment.updated": "派工狀態更新",
    "artifact.published": "對外發布",
    "report.verification_changed": "通報查證",
    "form_submission.created": "表單提交",
}


def _summarize(event_type: str, payload: dict) -> str:
    if event_type == "incident.created":
        return f"建立事件「{payload.get('title', '')}」，嚴重度 {payload.get('severity', '')}。"
    if event_type == "incident.bootstrapped":
        n = payload.get("artifact_count", 0)
        mode = payload.get("mode", "rule")
        return f"生成 {n} 個元件（{'AI 草擬' if mode == 'ai' else '規則式'}）。"
    if event_type == "artifact.approved":
        return "一個元件通過審核，可對外公開。"
    if event_type == "artifact.rejected":
        return "一個元件審核退回。"
    if event_type == "disaster_report.created":
        return (
            f"收到通報：{payload.get('need_type', '')}，嚴重度 {payload.get('severity', '')}"
            f"，triage {payload.get('triage_priority', 'normal')}。"
        )
    if event_type == "agent.planned":
        reco = payload.get("recommended", [])
        return f"Agent 以 {payload.get('intent_mode', '')} 模式提案 {len(reco)} 個建議模組。"
    if event_type == "agent.executed":
        return (
            f"Agent 生成 {payload.get('created', 0)} 個模組"
            f"（略過 {payload.get('skipped', 0)}、失敗 {payload.get('failed', 0)}）。"
        )
    if event_type == "resource_offer.created":
        return f"登記資源：{payload.get('offer_type', '')} / {payload.get('item', '')}。"
    if event_type == "assignment.created":
        return "將資源派遣至一筆通報需求。"
    if event_type == "assignment.updated":
        return f"派工狀態更新為 {payload.get('status', '')}。"
    if event_type == "artifact.published":
        return f"審核通過內容已發布至 {payload.get('channel', '')}（{payload.get('connector', '')}）。"
    if event_type == "report.verification_changed":
        return f"通報查證狀態更新為 {payload.get('verification_status', '')}。"
    if event_type == "form_submission.created":
        return f"收到表單提交：{payload.get('form_key', '')}。"
    return event_type


def build_timeline(
    db: Session, incident_id: uuid.UUID, *, limit: int = 100, offset: int = 0
) -> tuple[list[dict], int]:
    where = EventOutbox.payload["incident_id"].astext == str(incident_id)
    total = db.scalar(select(func.count()).select_from(EventOutbox).where(where))
    rows = db.scalars(
        select(EventOutbox)
        .where(where)
        .order_by(EventOutbox.created_at.asc(), EventOutbox.id.asc())
        .limit(limit)
        .offset(offset)
    ).all()
    items = [
        {
            "event_type": e.event_type,
            "label": _LABELS.get(e.event_type, e.event_type),
            "summary": _summarize(e.event_type, e.payload or {}),
            "at": e.created_at.isoformat(),
        }
        for e in rows
    ]
    return items, int(total or 0)
