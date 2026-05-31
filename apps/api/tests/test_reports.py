"""Disaster report, GeoJSON and public-preview integration tests (need a live database)."""
from __future__ import annotations

import uuid

import pytest
from fastapi.testclient import TestClient

from main import app

client = TestClient(app)


def _create_incident() -> str:
    unique = uuid.uuid4().hex[:8]
    payload = {
        "source": "manual",
        "event_type": "barrier_lake_alert",
        "title": f"P3測試堰塞湖事件-{unique}",
        "severity": "high",
        "location": {
            "county": "花蓮縣",
            "town": "光復鄉",
            "river": "馬太鞍溪",
            "lat": 23.66,
            "lon": 121.42,
        },
        "source_refs": [{"source_name": "manual", "source_ref": f"mock://{unique}"}],
    }
    resp = client.post("/v1/events/alerts", json=payload)
    assert resp.status_code == 201, resp.text
    return resp.json()["incident_id"]


def _incident_slug(incident_id: str) -> str:
    return client.get(f"/v1/incidents/{incident_id}").json()["slug"]


def _submit(incident_id: str, **overrides) -> dict:
    body = {
        "reporter_name": "王先生",
        "reporter_contact": "0912345678",
        "need_type": "mud_removal",
        "description": "住家一樓淤泥約 30 公分，需要協助清理",
        "severity": "high",
        "lat": 23.665,
        "lon": 121.421,
        "address": "花蓮縣光復鄉某路段",
    }
    body.update(overrides)
    return client.post(f"/v1/incidents/{incident_id}/reports", json=body)


@pytest.fixture()
def incident_id() -> str:
    return _create_incident()


def test_create_report_succeeds_and_persists(incident_id):
    resp = _submit(incident_id)
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["status"] == "new"
    report_id = body["report_id"]

    detail = client.get(f"/v1/reports/{report_id}")
    assert detail.status_code == 200
    assert detail.json()["incident_id"] == incident_id


def test_report_raw_payload_is_preserved(incident_id):
    resp = _submit(incident_id, description="特殊描述-RAW", reporter_contact="0900000000")
    report_id = resp.json()["report_id"]
    detail = client.get(f"/v1/reports/{report_id}").json()
    assert detail["raw_payload"]["description"] == "特殊描述-RAW"
    assert detail["raw_payload"]["reporter_contact"] == "0900000000"
    assert detail["raw_payload"]["need_type"] == "mud_removal"


def test_report_on_missing_incident_returns_404():
    resp = _submit(str(uuid.uuid4()))
    assert resp.status_code == 404
    assert resp.json()["detail"] == "Incident not found"


def test_report_on_archived_incident_returns_400(incident_id):
    from app.db.database import SessionLocal
    from app.db.models import Incident

    db = SessionLocal()
    try:
        inc = db.get(Incident, uuid.UUID(incident_id))
        inc.status = "archived"
        db.commit()
    finally:
        db.close()

    resp = _submit(incident_id)
    assert resp.status_code == 400
    assert resp.json()["detail"] == (
        "Incident is archived and cannot accept new reports"
    )


def test_partial_coordinates_returns_422(incident_id):
    resp = _submit(incident_id, lat=23.5, lon=None)
    assert resp.status_code == 422
    assert "lat and lon must be provided together" in resp.text


def test_list_reports_filters(incident_id):
    _submit(incident_id, need_type="mud_removal", severity="high")
    _submit(incident_id, need_type="supply_need", severity="medium", lat=None, lon=None)

    all_reports = client.get(f"/v1/incidents/{incident_id}/reports").json()
    assert all_reports["total"] == 2

    by_need = client.get(
        f"/v1/incidents/{incident_id}/reports", params={"need_type": "supply_need"}
    ).json()
    assert by_need["total"] == 1
    assert by_need["items"][0]["need_type"] == "supply_need"

    by_sev = client.get(
        f"/v1/incidents/{incident_id}/reports", params={"severity": "high"}
    ).json()
    assert by_sev["total"] == 1

    assert "reporter_contact" not in by_need["items"][0]


def test_get_report_detail(incident_id):
    report_id = _submit(incident_id).json()["report_id"]
    detail = client.get(f"/v1/reports/{report_id}").json()
    assert detail["need_type"] == "mud_removal"
    assert detail["reporter_name"] == "王先生"


def test_missing_report_returns_404():
    resp = client.get(f"/v1/reports/{uuid.uuid4()}")
    assert resp.status_code == 404
    assert resp.json()["detail"] == "Report not found"


def test_geojson_only_includes_geolocated_reports_without_pii(incident_id):
    _submit(incident_id, lat=23.665, lon=121.421)
    _submit(incident_id, lat=None, lon=None, need_type="supply_need")

    gj = client.get(f"/v1/incidents/{incident_id}/reports.geojson").json()
    assert gj["type"] == "FeatureCollection"
    assert len(gj["features"]) == 1

    feature = gj["features"][0]
    assert feature["geometry"]["type"] == "Point"
    # GeoJSON coordinates are [lon, lat]
    assert feature["geometry"]["coordinates"] == [121.421, 23.665]

    props = feature["properties"]
    assert "report_id" in props and "need_type" in props
    assert "reporter_name" not in props
    assert "reporter_contact" not in props


def _bootstrap_and_approve_one(incident_id: str) -> str:
    client.post(f"/v1/bootstrap/incidents/{incident_id}")
    reviews = client.get(
        "/v1/reviews", params={"incident_id": incident_id}
    ).json()["items"]
    review = reviews[0]
    client.post(f"/v1/reviews/{review['id']}/approve", json={})
    artifact = client.get(f"/v1/artifacts/{review['artifact_id']}").json()
    return artifact["artifact_type"]


def test_public_preview_returns_only_approved(incident_id):
    approved_type = _bootstrap_and_approve_one(incident_id)
    slug = _incident_slug(incident_id)

    preview = client.get(f"/v1/public/preview/{slug}")
    assert preview.status_code == 200
    body = preview.json()

    assert body["incident"]["slug"] == slug
    assert len(body["artifacts"]) == 1
    assert body["artifacts"][0]["artifact_type"] == approved_type
    assert "content" in body["artifacts"][0]

    assert "reports_geojson" in body["public_endpoints"]
    assert "review_tasks" not in body


def test_public_preview_excludes_pending_and_rejected(incident_id):
    client.post(f"/v1/bootstrap/incidents/{incident_id}")
    reviews = client.get(
        "/v1/reviews", params={"incident_id": incident_id}
    ).json()["items"]
    client.post(f"/v1/reviews/{reviews[0]['id']}/approve", json={})
    client.post(f"/v1/reviews/{reviews[1]['id']}/reject", json={})

    slug = _incident_slug(incident_id)
    body = client.get(f"/v1/public/preview/{slug}").json()
    assert len(body["artifacts"]) == 1

    statuses = client.get(
        "/v1/artifacts", params={"incident_id": incident_id}
    ).json()["items"]
    assert any(a["status"] == "pending_review" for a in statuses)
    assert any(a["status"] == "rejected" for a in statuses)


def test_public_preview_missing_slug_returns_404():
    resp = client.get(f"/v1/public/preview/no-such-slug-{uuid.uuid4().hex}")
    assert resp.status_code == 404
    assert resp.json()["detail"] == "Incident not found"


def test_outbox_contains_disaster_report_created(incident_id):
    report_id = _submit(incident_id).json()["report_id"]
    events = client.get("/v1/events/outbox", params={"limit": 100}).json()["items"]
    matching = [
        e
        for e in events
        if e["event_type"] == "disaster_report.created"
        and e.get("payload", {}).get("report_id") == report_id
    ]
    assert len(matching) == 1
    payload = matching[0]["payload"]
    assert payload["incident_id"] == incident_id
    assert payload["need_type"] == "mud_removal"
    assert payload["severity"] == "high"
