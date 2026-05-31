"""Integration tests for the incident summary read-model (need a live database)."""
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
            "event_type": "barrier_lake_alert",
            "title": f"摘要測試-{unique}",
            "severity": "high",
            "location": {"county": "花蓮縣", "town": "光復鄉", "river": "馬太鞍溪", "lat": 23.66, "lon": 121.42},
            "source_refs": [{"source_name": "manual", "source_ref": f"mock://{unique}"}],
        },
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["incident_id"]


def _summary(incident_id: str) -> dict:
    r = client.get(f"/v1/incidents/{incident_id}/summary")
    assert r.status_code == 200, r.text
    return r.json()


def test_summary_missing_incident_404():
    r = client.get(f"/v1/incidents/{uuid.uuid4()}/summary")
    assert r.status_code == 404
    assert r.json()["detail"] == "Incident not found"


def test_summary_zeros_before_bootstrap():
    iid = _create_incident()
    s = _summary(iid)
    assert s["incident_id"] == iid
    assert s["artifacts"]["total"] == 0
    assert s["reviews"]["total"] == 0
    assert s["reports"]["total"] == 0
    assert s["readiness"] == {
        "bootstrapped": False,
        "has_public_content": False,
        "has_reports": False,
    }


def test_summary_after_bootstrap_and_approve():
    iid = _create_incident()
    client.post(f"/v1/bootstrap/incidents/{iid}")
    reviews = client.get("/v1/reviews", params={"incident_id": iid}).json()["items"]
    client.post(f"/v1/reviews/{reviews[0]['id']}/approve", json={})

    s = _summary(iid)
    assert s["artifacts"]["total"] == 6
    assert s["artifacts"]["approved"] == 1
    assert s["artifacts"]["pending_review"] == 5
    assert s["reviews"]["total"] == 6
    assert s["reviews"]["approved"] == 1
    assert s["reviews"]["pending"] == 5
    assert s["readiness"]["bootstrapped"] is True
    assert s["readiness"]["has_public_content"] is True


def test_summary_reports_breakdown():
    iid = _create_incident()

    def submit(need_type, severity, lat=None, lon=None):
        body = {
            "need_type": need_type,
            "description": f"{need_type} 測試",
            "severity": severity,
        }
        if lat is not None:
            body["lat"], body["lon"] = lat, lon
        r = client.post(f"/v1/incidents/{iid}/reports", json=body)
        assert r.status_code == 201, r.text

    submit("mud_removal", "high", 23.66, 121.42)
    submit("mud_removal", "medium")
    submit("supply_need", "low")

    s = _summary(iid)
    assert s["reports"]["total"] == 3
    assert s["reports"]["geolocated"] == 1

    need = {c["key"]: c["count"] for c in s["reports"]["by_need_type"]}
    assert need["mud_removal"] == 2
    assert need["supply_need"] == 1

    sev = {c["key"]: c["count"] for c in s["reports"]["by_severity"]}
    assert sev["high"] == 1 and sev["medium"] == 1 and sev["low"] == 1

    keys = [c["key"] for c in s["reports"]["by_need_type"]]
    assert keys.index("mud_removal") < keys.index("supply_need")

    assert s["readiness"]["has_reports"] is True
