"""Triage (report_auto_classify) and timeline (coordination_timeline) tests
(need a live database)."""
from __future__ import annotations

import uuid

import pytest
from fastapi.testclient import TestClient

from main import app

client = TestClient(app)


def _create_incident() -> str:
    unique = uuid.uuid4().hex[:8]
    resp = client.post(
        "/v1/events/alerts",
        json={
            "source": "manual",
            "event_type": "earthquake_alert",
            "title": f"triage-timeline-{unique}",
            "severity": "high",
            "location": {"county": "花蓮縣", "lat": 23.97, "lon": 121.6},
            "source_refs": [],
        },
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["incident_id"]


def _submit(iid: str, **over) -> dict:
    body = {"need_type": "supply_need", "description": "測試", "severity": "medium"}
    body.update(over)
    r = client.post(f"/v1/incidents/{iid}/reports", json=body)
    assert r.status_code == 201, r.text
    return r.json()


@pytest.fixture()
def incident_id() -> str:
    return _create_incident()


# ── triage ─────────────────────────────────────────────────────
def test_life_safety_need_is_critical(incident_id):
    rid = _submit(incident_id, need_type="trapped_person", severity="high")["report_id"]
    detail = client.get(f"/v1/reports/{rid}").json()
    assert detail["triage_priority"] == "critical"


def test_critical_severity_is_critical(incident_id):
    rid = _submit(incident_id, need_type="supply_need", severity="critical")["report_id"]
    assert client.get(f"/v1/reports/{rid}").json()["triage_priority"] == "critical"


def test_medical_medium_is_high(incident_id):
    rid = _submit(incident_id, need_type="medical_need", severity="medium")["report_id"]
    assert client.get(f"/v1/reports/{rid}").json()["triage_priority"] == "high"


def test_ordinary_low_is_low(incident_id):
    rid = _submit(incident_id, need_type="supply_need", severity="low")["report_id"]
    assert client.get(f"/v1/reports/{rid}").json()["triage_priority"] == "low"


def test_triage_priority_in_list_and_geojson(incident_id):
    _submit(incident_id, need_type="trapped_person", severity="high", lat=23.9, lon=121.6)
    items = client.get(f"/v1/incidents/{incident_id}/reports").json()["items"]
    assert items[0]["triage_priority"] == "critical"

    gj = client.get(f"/v1/incidents/{incident_id}/reports.geojson").json()
    assert gj["features"][0]["properties"]["triage_priority"] == "critical"
    # still no PII
    assert "reporter_contact" not in gj["features"][0]["properties"]


def test_retriage_endpoint(incident_id):
    rid = _submit(incident_id, need_type="fire", severity="low")["report_id"]
    # fire is life-safety, low severity => high
    re = client.post(f"/v1/reports/{rid}/retriage")
    assert re.status_code == 200
    assert re.json()["triage_priority"] == "high"


def test_retriage_missing_404():
    assert client.post(f"/v1/reports/{uuid.uuid4()}/retriage").status_code == 404


def test_summary_includes_triage(incident_id):
    _submit(incident_id, need_type="trapped_person", severity="critical")
    _submit(incident_id, need_type="supply_need", severity="low")
    s = client.get(f"/v1/incidents/{incident_id}/summary").json()
    assert s["reports"]["critical_open"] == 1
    triage = {c["key"]: c["count"] for c in s["reports"]["by_triage_priority"]}
    assert triage["critical"] == 1
    assert triage["low"] == 1


# ── timeline ───────────────────────────────────────────────────
def test_timeline_orders_events(incident_id):
    client.post(f"/v1/bootstrap/incidents/{incident_id}")
    reviews = client.get("/v1/reviews", params={"incident_id": incident_id}).json()["items"]
    client.post(f"/v1/reviews/{reviews[0]['id']}/approve", json={})
    _submit(incident_id, need_type="medical_need", severity="high")

    tl = client.get(f"/v1/incidents/{incident_id}/timeline")
    assert tl.status_code == 200
    items = tl.json()["items"]
    types = [i["event_type"] for i in items]
    assert types[0] == "incident.created"
    assert "incident.bootstrapped" in types
    assert "artifact.approved" in types
    assert "disaster_report.created" in types
    # every item has a human label + summary
    assert all(i["label"] and i["summary"] for i in items)


def test_timeline_missing_incident_404():
    assert client.get(f"/v1/incidents/{uuid.uuid4()}/timeline").status_code == 404


def test_timeline_records_agent_actions():
    plan = client.post("/v1/agent/plan", json={"message": "地震 時間軸測試"}).json()
    iid = plan["incident"]["id"]
    client.post("/v1/agent/execute", json={"incident_id": iid, "module_ids": ["sos_form"]})
    types = {i["event_type"] for i in client.get(f"/v1/incidents/{iid}/timeline").json()["items"]}
    assert "agent.planned" in types
    assert "agent.executed" in types


# ── catalogue reflects the now-live processors ─────────────────
def test_processor_modules_now_implemented_with_endpoint():
    body = client.get("/v1/modules", params={"implemented": "true"}).json()
    by_id = {m["id"]: m for m in body["items"]}
    assert by_id["report_auto_classify"]["implemented"] is True
    assert by_id["report_auto_classify"]["endpoint"]
    assert by_id["coordination_timeline"]["implemented"] is True


def test_processor_not_bootstrap_executable():
    iid = _create_incident()
    resp = client.post(
        f"/v1/bootstrap/incidents/{iid}", params={"module_ids": ["coordination_timeline"]}
    )
    assert resp.status_code == 400
    assert "served at" in resp.json()["detail"]
