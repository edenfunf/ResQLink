"""Module registry, catalogue API, multi-scenario and selective-bootstrap tests
(need a live database)."""
from __future__ import annotations

import uuid

import pytest
from fastapi.testclient import TestClient

from main import app

client = TestClient(app)

CORE_MODULE_IDS = {
    "microsite_config",
    "damage_report_form",
    "volunteer_form",
    "supply_form",
    "map_bundle",
    "public_notice_draft",
}


def _create_incident(event_type: str = "barrier_lake_alert", **loc) -> str:
    unique = uuid.uuid4().hex[:8]
    location = {"county": "花蓮縣", "town": "光復鄉", "river": "馬太鞍溪", "lat": 23.66, "lon": 121.42}
    location.update(loc)
    resp = client.post(
        "/v1/events/alerts",
        json={
            "source": "manual",
            "event_type": event_type,
            "title": f"模組測試-{unique}",
            "severity": "high",
            "location": location,
            "source_refs": [{"source_name": "manual", "source_ref": f"mock://{unique}"}],
        },
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["incident_id"]


# ── registry / catalogue API ──────────────────────────────────────
def test_modules_catalogue_lists_core_and_extended():
    body = client.get("/v1/modules").json()
    ids = {m["id"] for m in body["items"]}
    assert CORE_MODULE_IDS.issubset(ids)
    # extended modules are present too
    assert {"evacuation_guide", "sos_form", "fb_page_post", "supply_dashboard"}.issubset(ids)
    assert body["total"] == len(body["items"])


def test_core_modules_are_default_enabled():
    body = client.get("/v1/modules").json()
    defaults = {m["id"] for m in body["items"] if m["default_enabled"]}
    assert defaults == CORE_MODULE_IDS


def test_modules_filter_by_implemented():
    impl = client.get("/v1/modules", params={"implemented": "true"}).json()
    ids = {m["id"] for m in impl["items"]}
    assert "microsite_config" in ids
    assert all(m["implemented"] is True for m in impl["items"])

    planned = client.get("/v1/modules", params={"implemented": "false"}).json()
    # all roadmap placeholders have now been implemented (P3 complete)
    assert all(m["implemented"] is False for m in planned["items"])


def test_modules_filter_by_category():
    body = client.get("/v1/modules", params={"category": "outreach"}).json()
    assert body["total"] >= 3
    assert all(m["category"] == "outreach" for m in body["items"])


def test_module_categories_endpoint():
    body = client.get("/v1/modules/categories").json()
    keys = {c["key"] for c in body["items"]}
    assert {"info_hub", "reporting", "volunteer", "supply", "matching"}.issubset(keys)


def test_single_module_and_404():
    ok = client.get("/v1/modules/sos_form")
    assert ok.status_code == 200
    assert ok.json()["category"] == "help_request"

    missing = client.get("/v1/modules/no_such_module")
    assert missing.status_code == 404


# ── default bootstrap unchanged ───────────────────────────────────
def test_default_bootstrap_still_six_core():
    iid = _create_incident()
    body = client.post(f"/v1/bootstrap/incidents/{iid}").json()
    types = {a["artifact_type"] for a in body["artifacts"]}
    assert types == CORE_MODULE_IDS


# ── selective bootstrap (the agent seam) ─────────────────────────
def test_selective_bootstrap_generates_only_requested():
    iid = _create_incident()
    body = client.post(
        f"/v1/bootstrap/incidents/{iid}",
        params={"module_ids": ["evacuation_guide", "sos_form"]},
    ).json()
    types = {a["artifact_type"] for a in body["artifacts"]}
    assert types == {"evacuation_guide", "sos_form"}
    assert len(body["review_tasks"]) == 2

    total = client.get("/v1/artifacts", params={"incident_id": iid}).json()["total"]
    assert total == 2


def test_selective_bootstrap_is_idempotent_per_module():
    iid = _create_incident()
    client.post(f"/v1/bootstrap/incidents/{iid}", params={"module_ids": ["faq"]})
    # request faq again + a new one; faq must not duplicate
    body = client.post(
        f"/v1/bootstrap/incidents/{iid}",
        params={"module_ids": ["faq", "press_release"]},
    ).json()
    assert {a["artifact_type"] for a in body["artifacts"]} == {"faq", "press_release"}

    faqs = client.get(
        "/v1/artifacts", params={"incident_id": iid, "artifact_type": "faq"}
    ).json()
    assert faqs["total"] == 1


def test_bootstrap_unknown_module_returns_400():
    iid = _create_incident()
    resp = client.post(
        f"/v1/bootstrap/incidents/{iid}", params={"module_ids": ["nope"]}
    )
    assert resp.status_code == 400
    assert "Unknown module" in resp.json()["detail"]


def test_bootstrap_non_generator_module_returns_400():
    iid = _create_incident()
    resp = client.post(
        f"/v1/bootstrap/incidents/{iid}",
        params={"module_ids": ["volunteer_dispatch"]},
    )
    assert resp.status_code == 400
    assert "served at" in resp.json()["detail"]


def test_bootstrap_live_processor_module_returns_400():
    iid = _create_incident()
    resp = client.post(
        f"/v1/bootstrap/incidents/{iid}",
        params={"module_ids": ["needs_matching_engine"]},
    )
    assert resp.status_code == 400
    assert "served at" in resp.json()["detail"]


# ── multi-disaster: same modules, scenario-specific content ───────
def test_earthquake_scenario_produces_earthquake_content():
    iid = _create_incident(event_type="earthquake_alert", river=None)
    client.post(f"/v1/bootstrap/incidents/{iid}")

    arts = client.get("/v1/artifacts", params={"incident_id": iid}).json()["items"]
    form_id = next(a["id"] for a in arts if a["artifact_type"] == "damage_report_form")
    form = client.get(f"/v1/artifacts/{form_id}").json()
    options = next(
        f["options"] for f in form["content"]["fields"] if f["name"] == "need_type"
    )
    assert "building_collapse" in options
    assert "mud_removal" not in options


def test_barrier_lake_scenario_keeps_water_content():
    iid = _create_incident(event_type="barrier_lake_alert")
    client.post(f"/v1/bootstrap/incidents/{iid}")
    arts = client.get("/v1/artifacts", params={"incident_id": iid}).json()["items"]
    form_id = next(a["id"] for a in arts if a["artifact_type"] == "damage_report_form")
    form = client.get(f"/v1/artifacts/{form_id}").json()
    options = next(
        f["options"] for f in form["content"]["fields"] if f["name"] == "need_type"
    )
    assert "mud_removal" in options
    assert "building_collapse" not in options


def test_unsupported_event_type_still_400():
    unique = uuid.uuid4().hex[:8]
    resp = client.post(
        "/v1/events/alerts",
        json={
            "source": "manual",
            "event_type": "volcano_alert",
            "title": f"未知災別-{unique}",
            "severity": "high",
            "location": {"county": "花蓮縣"},
            "source_refs": [],
        },
    )
    assert resp.status_code == 400
