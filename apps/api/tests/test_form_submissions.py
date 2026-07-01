"""Generic form submission tests — config-driven forms become live
(need a live database)."""
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
            "event_type": "earthquake_alert",
            "title": f"form-{unique}",
            "severity": "high",
            "location": {"county": "花蓮縣"},
            "source_refs": [],
        },
    )
    assert r.status_code == 201, r.text
    return r.json()["incident_id"]


def _approved_form(iid: str, module_id: str) -> str:
    """Bootstrap + approve a form artifact, return its id."""
    client.post(f"/v1/bootstrap/incidents/{iid}", params={"module_ids": [module_id]})
    art = client.get(
        "/v1/artifacts", params={"incident_id": iid, "artifact_type": module_id}
    ).json()["items"][0]
    rev = client.get("/v1/reviews", params={"incident_id": iid}).json()["items"]
    rid = next(r["id"] for r in rev if r["artifact_id"] == art["id"])
    client.post(f"/v1/reviews/{rid}/approve", json={})
    return art["id"]


@pytest.fixture()
def incident_id() -> str:
    return _incident()


SOS_OK = {
    "need_type": "trapped_person",
    "people_count": 2,
    "description": "二樓受困",
    "address": "中正路一段",
    "reporter_contact": "0912000111",
}


def test_submit_approved_form(incident_id):
    aid = _approved_form(incident_id, "sos_form")
    resp = client.post(f"/v1/artifacts/{aid}/submissions", json={"payload": SOS_OK})
    assert resp.status_code == 201, resp.text
    assert resp.json()["submission_id"]


def test_submission_masks_pii(incident_id):
    aid = _approved_form(incident_id, "sos_form")
    client.post(f"/v1/artifacts/{aid}/submissions", json={"payload": SOS_OK})
    subs = client.get(f"/v1/artifacts/{aid}/submissions").json()
    assert subs["total"] == 1
    p = subs["items"][0]["payload"]
    assert p["reporter_contact"] == "***"  # pii masked
    assert p["address"] == "中正路一段"  # non-pii intact


def test_missing_required_field_400(incident_id):
    aid = _approved_form(incident_id, "sos_form")
    bad = dict(SOS_OK)
    del bad["people_count"]
    resp = client.post(f"/v1/artifacts/{aid}/submissions", json={"payload": bad})
    assert resp.status_code == 400
    assert "required" in resp.json()["detail"].lower()


def test_unknown_fields_dropped(incident_id):
    aid = _approved_form(incident_id, "sos_form")
    payload = dict(SOS_OK, hacker_field="x")
    client.post(f"/v1/artifacts/{aid}/submissions", json={"payload": payload})
    p = client.get(f"/v1/artifacts/{aid}/submissions").json()["items"][0]["payload"]
    assert "hacker_field" not in p


def test_submit_before_approval_400(incident_id):
    client.post(f"/v1/bootstrap/incidents/{incident_id}", params={"module_ids": ["sos_form"]})
    aid = client.get(
        "/v1/artifacts", params={"incident_id": incident_id, "artifact_type": "sos_form"}
    ).json()["items"][0]["id"]
    resp = client.post(f"/v1/artifacts/{aid}/submissions", json={"payload": SOS_OK})
    assert resp.status_code == 400
    assert "approved" in resp.json()["detail"]


def test_non_form_artifact_400(incident_id):
    aid = _approved_form(incident_id, "map_bundle")  # not a form (no fields)
    resp = client.post(f"/v1/artifacts/{aid}/submissions", json={"payload": {}})
    assert resp.status_code == 400
    assert "not a submittable form" in resp.json()["detail"]


def test_submit_missing_artifact_404():
    resp = client.post(
        f"/v1/artifacts/{uuid.uuid4()}/submissions", json={"payload": {}}
    )
    assert resp.status_code == 404


def test_submission_pagination(incident_id):
    aid = _approved_form(incident_id, "sos_form")
    for _ in range(3):
        client.post(f"/v1/artifacts/{aid}/submissions", json={"payload": SOS_OK})

    page1 = client.get(f"/v1/artifacts/{aid}/submissions", params={"limit": 2, "offset": 0}).json()
    assert page1["total"] == 3
    assert len(page1["items"]) == 2
    assert page1["limit"] == 2 and page1["offset"] == 0

    page2 = client.get(f"/v1/artifacts/{aid}/submissions", params={"limit": 2, "offset": 2}).json()
    assert page2["total"] == 3
    assert len(page2["items"]) == 1


def test_timeline_pagination_fields(incident_id):
    tl = client.get(f"/v1/incidents/{incident_id}/timeline", params={"limit": 5}).json()
    assert "total" in tl and tl["limit"] == 5 and tl["offset"] == 0


def test_matches_pagination_fields(incident_id):
    m = client.get(f"/v1/incidents/{incident_id}/matches", params={"limit": 10}).json()
    assert "total_reports" in m and m["limit"] == 10 and m["offset"] == 0


def test_submission_in_timeline(incident_id):
    aid = _approved_form(incident_id, "sos_form")
    client.post(f"/v1/artifacts/{aid}/submissions", json={"payload": SOS_OK})
    types = {
        i["event_type"]
        for i in client.get(f"/v1/incidents/{incident_id}/timeline").json()["items"]
    }
    assert "form_submission.created" in types
