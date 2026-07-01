"""Cross-incident overview endpoint tests (need a live database)."""
from __future__ import annotations

import uuid

from fastapi.testclient import TestClient

from main import app

client = TestClient(app)

_KEYS = {
    "incidents_total",
    "incidents_open",
    "reviews_pending",
    "artifacts_pending_review",
    "artifacts_approved",
    "reports_total",
    "reports_critical_open",
    "reports_unverified",
    "resources_open",
    "assignments_active",
    "publications_total",
}


def test_overview_shape():
    body = client.get("/v1/overview").json()
    assert _KEYS.issubset(body.keys())
    assert all(isinstance(body[k], int) for k in _KEYS)


def test_overview_counts_increase_with_activity():
    before = client.get("/v1/overview").json()

    unique = uuid.uuid4().hex[:8]
    iid = client.post(
        "/v1/events/alerts",
        json={
            "source": "manual",
            "event_type": "earthquake_alert",
            "title": f"overview-{unique}",
            "severity": "critical",
            "location": {"county": "花蓮縣"},
            "source_refs": [],
        },
    ).json()["incident_id"]
    client.post(
        f"/v1/incidents/{iid}/reports",
        json={"need_type": "trapped_person", "description": "x", "severity": "critical"},
    )

    after = client.get("/v1/overview").json()
    assert after["incidents_total"] >= before["incidents_total"] + 1
    assert after["incidents_open"] >= before["incidents_open"] + 1
    assert after["reports_critical_open"] >= before["reports_critical_open"] + 1
