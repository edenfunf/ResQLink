"""Planner-Orchestrator agent — the single LLM decision point.

It does NOT write data or publish: it understands the request, proposes which
*registered* modules to run (with reasons), and on execute it dispatches the
chosen modules through the normal bootstrap path so every product still lands in
``pending_review``. The agent never bypasses the review gate.

Two stages, deliberately separate so a human confirms before anything is built:
  - ``plan``    : parse intent -> standardise an incident -> propose modules
  - ``execute`` : run the selected modules, isolating per-module failures
"""
from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import GeneratedArtifact, Incident
from app.modules import CATEGORIES, ModuleNotExecutableError, ModuleNotFoundError, registry
from app.modules.base import ModuleSpec
from app.services import ai_agent, bootstrap_service, incident_service, outbox_service


class IncidentNotFoundError(Exception):
    pass


# keyword fallback when the AI layer is unavailable (order = priority)
_SCENARIO_KEYWORDS: list[tuple[str, tuple[str, ...]]] = [
    ("earthquake", ("地震", "earthquake", "餘震", "規模")),
    ("typhoon", ("颱風", "台风", "typhoon", "強颱", "熱帶氣旋", "颶風")),
    ("barrier_lake", ("堰塞湖", "barrier", "溢流", "潰壩", "潰堤")),
    ("flood", ("淹水", "水災", "洪水", "豪雨", "暴雨", "積水", "flood")),
]

# extra modules recommended per scenario (on top of the default core modules);
# only those that are actually registered + applicable are surfaced.
_RECOMMENDED_EXTRAS: dict[str, tuple[str, ...]] = {
    "earthquake": ("sos_form", "evacuation_guide", "shelter_map", "fb_page_post"),
    "typhoon": ("evacuation_guide", "supply_dashboard", "fb_page_post"),
    "barrier_lake": ("evacuation_guide", "supply_dashboard", "fb_page_post"),
    "flood": ("evacuation_guide", "supply_dashboard", "fb_page_post"),
    "generic": (),
}

_REASONS: dict[str, str] = {
    "sos_form": "可能有受困/待救，建議開設緊急求援通道。",
    "evacuation_guide": "提供撤離與避難指引，降低初期資訊真空。",
    "shelter_map": "需要收容所資訊，建議提供避難地圖。",
    "fb_page_post": "主動把資訊擴散到民眾所在的社群管道。",
    "supply_dashboard": "提供物資需求即時看板，避免重複捐贈與物資爆量。",
}


def _heuristic_scenario(message: str) -> str:
    text = message.lower()
    for scenario, keywords in _SCENARIO_KEYWORDS:
        if any(kw.lower() in text for kw in keywords):
            return scenario
    return "generic"


def _heuristic_title(message: str) -> str:
    first = message.strip().splitlines()[0].strip() if message.strip() else ""
    if not first:
        return "災害事件"
    return first[:40]


def _resolve_intent(message: str) -> tuple[dict, str]:
    """Return (incident fields, mode). mode is 'ai' or 'heuristic'."""
    ai = ai_agent.parse_intent(message)
    if ai is not None:
        scenario = ai["scenario_type"] or _heuristic_scenario(message)
        return (
            {
                "title": ai["title"] or _heuristic_title(message),
                "scenario_type": scenario,
                "severity": ai["severity"] or "high",
                "county": ai["county"],
                "town": ai["town"],
                "river": ai["river"],
            },
            "ai",
        )
    return (
        {
            "title": _heuristic_title(message),
            "scenario_type": _heuristic_scenario(message),
            "severity": "high",
            "county": None,
            "town": None,
            "river": None,
        },
        "heuristic",
    )


def _existing_types(db: Session, incident_id: uuid.UUID) -> set[str]:
    rows = db.scalars(
        select(GeneratedArtifact.artifact_type).where(
            GeneratedArtifact.incident_id == incident_id
        )
    ).all()
    return set(rows)


def _reason_for(spec: ModuleSpec, recommended: bool) -> str:
    if not recommended:
        return f"可選：{CATEGORIES.get(spec.category, spec.category)}相關支援。"
    if spec.default_enabled:
        return "核心元件，建立救災基本盤。"
    return _REASONS.get(spec.id, f"建議於此災害啟用：{spec.name}。")


def plan(
    db: Session, message: str, incident_id: uuid.UUID | None = None
) -> dict:
    """Stage 1 — understand + propose. Creates/standardises an incident and
    returns the proposed modules. Nothing is generated here."""
    if incident_id is not None:
        incident = db.get(Incident, incident_id)
        if incident is None:
            raise IncidentNotFoundError()
        intent_mode = "existing"
    else:
        intent, intent_mode = _resolve_intent(message)
        incident = incident_service.create_incident_direct(db, source="agent", **intent)

    candidates = [
        s
        for s in registry.for_scenario(incident.scenario_type, implemented_only=True)
        if s.is_bootstrap_executable()
    ]
    existing = _existing_types(db, incident.id)
    default_ids = {s.id for s in registry.defaults_for_scenario(incident.scenario_type)}
    recommended_ids = default_ids | set(_RECOMMENDED_EXTRAS.get(incident.scenario_type, ()))

    proposals = []
    for spec in candidates:
        recommended = spec.id in recommended_ids
        proposals.append(
            {
                "id": spec.id,
                "name": spec.name,
                "description": spec.description,
                "category": spec.category,
                "category_label": CATEGORIES.get(spec.category, spec.category),
                "module_type": spec.module_type,
                "risk_level": spec.risk_for(incident.severity),
                "requires_review": spec.requires_review,
                "recommended": recommended,
                "reason": _reason_for(spec, recommended),
                "already_generated": spec.id in existing,
                "implemented": True,
                "executable": True,
            }
        )

    # surface the rest of the capability map too — built-in services and
    # roadmap blocks — so the plan shows everything the agent "knows",
    # not just what bootstrap can run today.
    candidate_ids = {p["id"] for p in proposals}
    for spec in registry.for_scenario(incident.scenario_type):
        if spec.id in candidate_ids:
            continue
        if spec.implemented:
            reason = "已內建的服務能力，於背景持續運行，無需生成。"
        else:
            reason = "規劃中的積木：規格已定義，實作後即可由 Agent 一鍵生成。"
        proposals.append(
            {
                "id": spec.id,
                "name": spec.name,
                "description": spec.description,
                "category": spec.category,
                "category_label": CATEGORIES.get(spec.category, spec.category),
                "module_type": spec.module_type,
                "risk_level": spec.risk_for(incident.severity),
                "requires_review": spec.requires_review,
                "recommended": False,
                "reason": reason,
                "already_generated": False,
                "implemented": spec.implemented,
                "executable": False,
            }
        )

    # runnable first (recommended on top), then built-in services, then roadmap
    proposals.sort(
        key=lambda p: (not p["executable"], not p["implemented"], not p["recommended"])
    )

    ai_enabled = ai_agent.is_enabled()
    if intent_mode != "existing":
        outbox_service.enqueue_event(
            db,
            event_type="agent.planned",
            aggregate_id=incident.id,
            payload={
                "incident_id": str(incident.id),
                "intent_mode": intent_mode,
                "recommended": sorted(p["id"] for p in proposals if p["recommended"]),
            },
        )
        db.commit()

    note = None
    if not ai_enabled:
        note = "AI 意圖解析未啟用（無金鑰），已改用關鍵字判斷災別；可手動修正後選擇模組。"

    return {
        "incident": incident,
        "intent_mode": intent_mode,
        "ai_enabled": ai_enabled,
        "note": note,
        "proposals": proposals,
    }


def execute(
    db: Session, incident_id: uuid.UUID, module_ids: list[str]
) -> dict:
    """Stage 2 — run the selected modules. Each module is generated
    independently so one failure does not abort the rest; products go to
    pending_review as usual."""
    incident = db.get(Incident, incident_id)
    if incident is None:
        raise IncidentNotFoundError()

    results = []
    created = skipped = failed = 0
    seen: set[str] = set()
    for module_id in module_ids:
        if module_id in seen:
            continue
        seen.add(module_id)
        try:
            artifacts, reviews, was_created = bootstrap_service.bootstrap_incident(
                db, incident_id, module_ids=[module_id]
            )
            artifact = artifacts[0] if artifacts else None
            review = reviews[0] if reviews else None
            status = "created" if was_created else "skipped"
            if was_created:
                created += 1
            else:
                skipped += 1
            results.append(
                {
                    "module_id": module_id,
                    "status": status,
                    "artifact_id": artifact.id if artifact else None,
                    "review_task_id": review.id if review else None,
                    "detail": None,
                }
            )
        except (ModuleNotFoundError, ModuleNotExecutableError) as exc:
            failed += 1
            results.append(
                {
                    "module_id": module_id,
                    "status": "failed",
                    "artifact_id": None,
                    "review_task_id": None,
                    "detail": str(exc),
                }
            )
        except Exception:  # isolate unexpected per-module errors
            db.rollback()
            failed += 1
            results.append(
                {
                    "module_id": module_id,
                    "status": "failed",
                    "artifact_id": None,
                    "review_task_id": None,
                    "detail": "module generation error",
                }
            )

    outbox_service.enqueue_event(
        db,
        event_type="agent.executed",
        aggregate_id=incident.id,
        payload={
            "incident_id": str(incident.id),
            "created": created,
            "skipped": skipped,
            "failed": failed,
            "module_ids": list(seen),
        },
    )
    db.commit()

    return {
        "incident_id": incident.id,
        "results": results,
        "created_count": created,
        "skipped_count": skipped,
        "failed_count": failed,
    }
