"""Report verification workflow tests (need a live database)."""
from __future__ import annotations

import uuid

import pytest
from fastapi.testclient import TestClient

from main import app

client = TestClient(app)


def _incident() -> str:
    unique = uuid.uuid4().hex[:8]
    r = client.post(
        "/v1/events/alerts",
        json={
            "source": "manual",
            "event_type": "flood_alert",
            "title": f"verify-{unique}",
            "severity": "high",
            "location": {"county": "花蓮縣"},
            "source_refs": [],
        },
    )
    assert r.status_code == 201, r.text
    return r.json()["incident_id"]


def _report(iid: str) -> str:
    r = client.post(
        f"/v1/incidents/{iid}/reports",
        json={"need_type": "flooding", "description": "x", "severity": "medium"},
    )
    assert r.status_code == 201, r.text
    return r.json()["report_id"]


@pytest.fixture()
def ids():
    iid = _incident()
    return iid, _report(iid)


def test_report_starts_unverified(ids):
    _, rid = ids
    assert client.get(f"/v1/reports/{rid}").json()["verification_status"] == "unverified"


def test_verify_report(ids):
    _, rid = ids
    resp = client.post(
        f"/v1/reports/{rid}/verification", json={"verification_status": "verified", "note": "已現場確認"}
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["verification_status"] == "verified"


def test_reject_then_restore(ids):
    _, rid = ids
    assert (
        client.post(f"/v1/reports/{rid}/verification", json={"verification_status": "rejected"}).json()[
            "verification_status"
        ]
        == "rejected"
    )
    assert (
        client.post(
            f"/v1/reports/{rid}/verification", json={"verification_status": "unverified"}
        ).json()["verification_status"]
        == "unverified"
    )


def test_verification_reflected_in_list(ids):
    iid, rid = ids
    client.post(f"/v1/reports/{rid}/verification", json={"verification_status": "verified"})
    items = client.get(f"/v1/incidents/{iid}/reports").json()["items"]
    assert items[0]["verification_status"] == "verified"


def test_verification_in_timeline(ids):
    iid, rid = ids
    client.post(f"/v1/reports/{rid}/verification", json={"verification_status": "verified"})
    types = {
        i["event_type"]
        for i in client.get(f"/v1/incidents/{iid}/timeline").json()["items"]
    }
    assert "report.verification_changed" in types


def test_verify_missing_report_404():
    resp = client.post(
        f"/v1/reports/{uuid.uuid4()}/verification", json={"verification_status": "verified"}
    )
    assert resp.status_code == 404


def test_invalid_verification_value_422(ids):
    _, rid = ids
    resp = client.post(
        f"/v1/reports/{rid}/verification", json={"verification_status": "bogus"}
    )
    assert resp.status_code == 422
