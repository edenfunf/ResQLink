"""Bootstrap, artifact and review-flow integration tests (need a live database)."""
from __future__ import annotations

import uuid

import pytest
from fastapi.testclient import TestClient

from main import app

client = TestClient(app)

EXPECTED_ARTIFACT_TYPES = {
    "microsite_config",
    "damage_report_form",
    "volunteer_form",
    "supply_form",
    "map_bundle",
    "public_notice_draft",
}


def _create_incident() -> str:
    unique = uuid.uuid4().hex[:8]
    payload = {
        "source": "manual",
        "event_type": "barrier_lake_alert",
        "title": f"測試堰塞湖事件-{unique}",
        "severity": "high",
        "location": {
            "county": "花蓮縣",
            "town": "光復鄉",
            "river": "馬太鞍溪",
            "lat": 23.66,
            "lon": 121.42,
        },
        "aoi": {"type": "Polygon", "coordinates": [[[121.4, 23.65], [121.45, 23.65], [121.45, 23.69], [121.4, 23.65]]]},
        "source_refs": [
            {"source_name": "manual", "source_ref": f"mock://{unique}"}
        ],
    }
    resp = client.post("/v1/events/alerts", json=payload)
    assert resp.status_code == 201, resp.text
    return resp.json()["incident_id"]


def _outbox_for_incident(incident_id: str) -> list[dict]:
    resp = client.get("/v1/events/outbox", params={"limit": 100})
    assert resp.status_code == 200
    return [
        e
        for e in resp.json()["items"]
        if e.get("payload", {}).get("incident_id") == incident_id
    ]


@pytest.fixture()
def incident_id() -> str:
    return _create_incident()


def test_create_incident_succeeds():
    incident_id = _create_incident()
    resp = client.get(f"/v1/incidents/{incident_id}")
    assert resp.status_code == 200
    assert resp.json()["status"] == "draft"


def test_bootstrap_creates_six_artifacts_and_six_reviews(incident_id):
    resp = client.post(f"/v1/bootstrap/incidents/{incident_id}")
    assert resp.status_code == 200, resp.text
    body = resp.json()

    assert body["incident_id"] == incident_id
    assert body["status"] == "pending_review"
    assert len(body["artifacts"]) == 6
    assert len(body["review_tasks"]) == 6

    types = {a["artifact_type"] for a in body["artifacts"]}
    assert types == EXPECTED_ARTIFACT_TYPES
    assert all(a["status"] == "pending_review" for a in body["artifacts"])
    assert all(r["status"] == "pending" for r in body["review_tasks"])


def test_bootstrap_persists_to_db(incident_id):
    client.post(f"/v1/bootstrap/incidents/{incident_id}")

    artifacts = client.get("/v1/artifacts", params={"incident_id": incident_id})
    assert artifacts.status_code == 200
    assert artifacts.json()["total"] == 6

    reviews = client.get("/v1/reviews", params={"incident_id": incident_id})
    assert reviews.status_code == 200
    assert reviews.json()["total"] == 6


def test_bootstrap_is_idempotent(incident_id):
    first = client.post(f"/v1/bootstrap/incidents/{incident_id}").json()
    second = client.post(f"/v1/bootstrap/incidents/{incident_id}").json()

    first_ids = sorted(a["id"] for a in first["artifacts"])
    second_ids = sorted(a["id"] for a in second["artifacts"])
    assert first_ids == second_ids

    total = client.get(
        "/v1/artifacts", params={"incident_id": incident_id}
    ).json()["total"]
    assert total == 6


def test_bootstrap_missing_incident_returns_404():
    resp = client.post(f"/v1/bootstrap/incidents/{uuid.uuid4()}")
    assert resp.status_code == 404
    assert resp.json()["detail"] == "Incident not found"


def test_approve_review_marks_artifact_approved(incident_id):
    client.post(f"/v1/bootstrap/incidents/{incident_id}")
    reviews = client.get(
        "/v1/reviews", params={"incident_id": incident_id}
    ).json()["items"]
    review = reviews[0]

    resp = client.post(
        f"/v1/reviews/{review['id']}/approve", json={"note": "ok"}
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["status"] == "approved"
    assert body["artifact_status"] == "approved"

    artifact = client.get(f"/v1/artifacts/{review['artifact_id']}").json()
    assert artifact["status"] == "approved"


def test_reject_review_marks_artifact_rejected(incident_id):
    client.post(f"/v1/bootstrap/incidents/{incident_id}")
    reviews = client.get(
        "/v1/reviews", params={"incident_id": incident_id}
    ).json()["items"]
    review = reviews[1]

    resp = client.post(
        f"/v1/reviews/{review['id']}/reject",
        json={"note": "需要補充官方來源"},
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["status"] == "rejected"
    assert body["artifact_status"] == "rejected"

    artifact = client.get(f"/v1/artifacts/{review['artifact_id']}").json()
    assert artifact["status"] == "rejected"


def test_double_decision_returns_400(incident_id):
    client.post(f"/v1/bootstrap/incidents/{incident_id}")
    review = client.get(
        "/v1/reviews", params={"incident_id": incident_id}
    ).json()["items"][0]

    first = client.post(f"/v1/reviews/{review['id']}/approve", json={})
    assert first.status_code == 200

    again = client.post(f"/v1/reviews/{review['id']}/approve", json={})
    assert again.status_code == 400
    assert again.json()["detail"] == "Review task has already been processed"

    reject = client.post(f"/v1/reviews/{review['id']}/reject", json={})
    assert reject.status_code == 400


def test_review_missing_returns_404():
    resp = client.post(f"/v1/reviews/{uuid.uuid4()}/approve", json={})
    assert resp.status_code == 404
    assert resp.json()["detail"] == "Review task not found"


def test_artifact_missing_returns_404():
    resp = client.get(f"/v1/artifacts/{uuid.uuid4()}")
    assert resp.status_code == 404
    assert resp.json()["detail"] == "Artifact not found"


def test_outbox_contains_review_events(incident_id):
    client.post(f"/v1/bootstrap/incidents/{incident_id}")
    reviews = client.get(
        "/v1/reviews", params={"incident_id": incident_id}
    ).json()["items"]
    client.post(f"/v1/reviews/{reviews[0]['id']}/approve", json={})
    client.post(f"/v1/reviews/{reviews[1]['id']}/reject", json={})

    event_types = {e["event_type"] for e in _outbox_for_incident(incident_id)}
    assert "incident.created" in event_types
    assert "incident.bootstrapped" in event_types
    assert "artifact.approved" in event_types
    assert "artifact.rejected" in event_types
