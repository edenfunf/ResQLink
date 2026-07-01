"""Dispatch (volunteer_dispatch) and publication (fb/line actions) tests
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
            "event_type": "flood_alert",
            "title": f"dispatch-{unique}",
            "severity": "high",
            "location": {"county": "花蓮縣", "lat": 23.66, "lon": 121.42},
            "source_refs": [],
        },
    )
    assert r.status_code == 201, r.text
    return r.json()["incident_id"]


def _report(iid: str, **over) -> str:
    body = {"need_type": "mud_removal", "description": "需要清淤", "severity": "high"}
    body.update(over)
    r = client.post(f"/v1/incidents/{iid}/reports", json=body)
    assert r.status_code == 201, r.text
    return r.json()["report_id"]


def _offer(iid: str, **over) -> str:
    body = {"offer_type": "volunteer", "item": "清淤", "quantity": 5}
    body.update(over)
    r = client.post(f"/v1/incidents/{iid}/resources", json=body)
    assert r.status_code == 201, r.text
    return r.json()["offer_id"]


@pytest.fixture()
def incident_id() -> str:
    return _incident()


# ── dispatch ───────────────────────────────────────────────────
def test_create_assignment_syncs_statuses(incident_id):
    rid = _report(incident_id)
    oid = _offer(incident_id)
    resp = client.post(
        f"/v1/incidents/{incident_id}/assignments",
        json={"report_id": rid, "offer_id": oid, "note": "就近派工"},
    )
    assert resp.status_code == 201, resp.text
    assert resp.json()["status"] == "assigned"

    # report -> in_progress, offer -> matched
    rep = client.get(f"/v1/reports/{rid}").json()
    assert rep["status"] == "in_progress"
    offers = client.get(f"/v1/incidents/{incident_id}/resources").json()["items"]
    assert offers[0]["status"] == "matched"


def test_assignment_status_transitions(incident_id):
    rid, oid = _report(incident_id), _offer(incident_id)
    aid = client.post(
        f"/v1/incidents/{incident_id}/assignments",
        json={"report_id": rid, "offer_id": oid},
    ).json()["id"]

    ok = client.patch(f"/v1/assignments/{aid}", json={"status": "in_progress"})
    assert ok.status_code == 200
    done = client.patch(f"/v1/assignments/{aid}", json={"status": "done"})
    assert done.status_code == 200

    # done closes the loop
    assert client.get(f"/v1/reports/{rid}").json()["status"] == "resolved"
    offers = client.get(f"/v1/incidents/{incident_id}/resources").json()["items"]
    assert offers[0]["status"] == "closed"


def test_invalid_transition_returns_400(incident_id):
    rid, oid = _report(incident_id), _offer(incident_id)
    aid = client.post(
        f"/v1/incidents/{incident_id}/assignments",
        json={"report_id": rid, "offer_id": oid},
    ).json()["id"]
    client.patch(f"/v1/assignments/{aid}", json={"status": "done"})
    # done is terminal
    bad = client.patch(f"/v1/assignments/{aid}", json={"status": "in_progress"})
    assert bad.status_code == 400


def test_cancel_releases_both_sides(incident_id):
    rid, oid = _report(incident_id), _offer(incident_id)
    aid = client.post(
        f"/v1/incidents/{incident_id}/assignments",
        json={"report_id": rid, "offer_id": oid},
    ).json()["id"]
    client.patch(f"/v1/assignments/{aid}", json={"status": "cancelled"})
    assert client.get(f"/v1/reports/{rid}").json()["status"] == "triaged"
    offers = client.get(f"/v1/incidents/{incident_id}/resources").json()["items"]
    assert offers[0]["status"] == "open"


def test_assignment_cross_incident_report_404(incident_id):
    other = _incident()
    rid = _report(other)  # belongs to a different incident
    oid = _offer(incident_id)
    resp = client.post(
        f"/v1/incidents/{incident_id}/assignments",
        json={"report_id": rid, "offer_id": oid},
    )
    assert resp.status_code == 404


def test_assignment_in_timeline(incident_id):
    rid, oid = _report(incident_id), _offer(incident_id)
    client.post(
        f"/v1/incidents/{incident_id}/assignments",
        json={"report_id": rid, "offer_id": oid},
    )
    types = {
        i["event_type"]
        for i in client.get(f"/v1/incidents/{incident_id}/timeline").json()["items"]
    }
    assert "assignment.created" in types


# ── publication ────────────────────────────────────────────────
def _bootstrap_fb(incident_id: str) -> tuple[str, str]:
    """Generate fb_page_post, return (artifact_id, review_id)."""
    client.post(
        f"/v1/bootstrap/incidents/{incident_id}", params={"module_ids": ["fb_page_post"]}
    )
    arts = client.get(
        "/v1/artifacts", params={"incident_id": incident_id, "artifact_type": "fb_page_post"}
    ).json()["items"]
    aid = arts[0]["id"]
    rev = client.get("/v1/reviews", params={"incident_id": incident_id}).json()["items"]
    rid = next(r["id"] for r in rev if r["artifact_id"] == aid)
    return aid, rid


def test_publish_requires_approval(incident_id):
    aid, _ = _bootstrap_fb(incident_id)
    # not approved yet
    resp = client.post(f"/v1/artifacts/{aid}/publish")
    assert resp.status_code == 400
    assert "approved" in resp.json()["detail"]


def test_publish_approved_artifact_simulated(incident_id):
    aid, rid = _bootstrap_fb(incident_id)
    client.post(f"/v1/reviews/{rid}/approve", json={})

    resp = client.post(f"/v1/artifacts/{aid}/publish")
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["channel"] == "facebook"
    assert body["connector"] == "simulated"
    assert body["status"] == "published"
    assert body["external_ref"].startswith("sim-facebook-")

    pubs = client.get(f"/v1/incidents/{incident_id}/publications").json()
    assert pubs["total"] == 1


def test_publish_explicit_channel(incident_id):
    aid, rid = _bootstrap_fb(incident_id)
    client.post(f"/v1/reviews/{rid}/approve", json={})
    resp = client.post(f"/v1/artifacts/{aid}/publish", json={"channel": "line"})
    assert resp.status_code == 201
    assert resp.json()["channel"] == "line"


def test_publish_non_publishable_type(incident_id):
    # map_bundle is not an outreach artifact
    client.post(
        f"/v1/bootstrap/incidents/{incident_id}", params={"module_ids": ["map_bundle"]}
    )
    art = client.get(
        "/v1/artifacts", params={"incident_id": incident_id, "artifact_type": "map_bundle"}
    ).json()["items"][0]
    rev = client.get("/v1/reviews", params={"incident_id": incident_id}).json()["items"]
    rid = next(r["id"] for r in rev if r["artifact_id"] == art["id"])
    client.post(f"/v1/reviews/{rid}/approve", json={})

    resp = client.post(f"/v1/artifacts/{art['id']}/publish")
    assert resp.status_code == 400
    assert "not publishable" in resp.json()["detail"]


def test_publish_in_timeline(incident_id):
    aid, rid = _bootstrap_fb(incident_id)
    client.post(f"/v1/reviews/{rid}/approve", json={})
    client.post(f"/v1/artifacts/{aid}/publish")
    types = {
        i["event_type"]
        for i in client.get(f"/v1/incidents/{incident_id}/timeline").json()["items"]
    }
    assert "artifact.published" in types


def test_publish_missing_artifact_404():
    resp = client.post(f"/v1/artifacts/{uuid.uuid4()}/publish")
    assert resp.status_code == 404


# ── catalogue: all roadmap modules now live ────────────────────
def test_all_modules_implemented():
    items = client.get("/v1/modules").json()["items"]
    assert all(m["implemented"] for m in items)
    by_id = {m["id"]: m for m in items}
    assert by_id["volunteer_dispatch"]["implemented"] is True
    assert by_id["fb_publish_action"]["implemented"] is True
    assert by_id["line_broadcast_action"]["implemented"] is True
