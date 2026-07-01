"""Real-vs-simulated connector dispatch + Google Forms export (need a live DB).

Live FB/LINE/Google calls can't run in CI, so we monkeypatch the connector
modules to assert the *dispatch* logic: real connector used when configured,
simulated fallback otherwise, ConnectorError surfaced as 502.
"""
from __future__ import annotations

import uuid

import pytest
from fastapi.testclient import TestClient

from app.connectors import base, facebook, google_forms, line
from main import app

client = TestClient(app)


def _incident() -> str:
    unique = uuid.uuid4().hex[:8]
    r = client.post(
        "/v1/events/alerts",
        json={
            "source": "manual",
            "event_type": "flood_alert",
            "title": f"conn-{unique}",
            "severity": "high",
            "location": {"county": "花蓮縣", "lat": 23.66, "lon": 121.42},
            "source_refs": [],
        },
    )
    assert r.status_code == 201, r.text
    return r.json()["incident_id"]


def _approved_artifact(incident_id: str, module_id: str, artifact_type: str) -> str:
    client.post(
        f"/v1/bootstrap/incidents/{incident_id}", params={"module_ids": [module_id]}
    )
    aid = client.get(
        "/v1/artifacts",
        params={"incident_id": incident_id, "artifact_type": artifact_type},
    ).json()["items"][0]["id"]
    revs = client.get("/v1/reviews", params={"incident_id": incident_id}).json()["items"]
    rid = next(r["id"] for r in revs if r["artifact_id"] == aid)
    client.post(f"/v1/reviews/{rid}/approve", json={})
    return aid


@pytest.fixture()
def incident_id() -> str:
    return _incident()


# ── facebook real dispatch ─────────────────────────────────────
def test_publish_uses_real_facebook_when_configured(incident_id, monkeypatch):
    aid = _approved_artifact(incident_id, "fb_page_post", "fb_page_post")

    monkeypatch.setattr(facebook, "is_configured", lambda: True)

    def fake_post(*, message, link=None):
        assert message  # message is built from the artifact content
        return {
            "connector": "facebook_graph",
            "status": "published",
            "external_ref": "100_200",
            "url": "https://www.facebook.com/100_200",
            "detail": "ok",
        }

    monkeypatch.setattr(facebook, "publish_post", fake_post)

    resp = client.post(f"/v1/artifacts/{aid}/publish")
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["connector"] == "facebook_graph"
    assert body["url"] == "https://www.facebook.com/100_200"
    assert body["external_ref"] == "100_200"


def test_publish_connector_error_returns_502(incident_id, monkeypatch):
    aid = _approved_artifact(incident_id, "fb_page_post", "fb_page_post")
    monkeypatch.setattr(facebook, "is_configured", lambda: True)

    def boom(*, message, link=None):
        raise base.ConnectorError("Facebook 發文失敗（401）：權杖無效")

    monkeypatch.setattr(facebook, "publish_post", boom)

    resp = client.post(f"/v1/artifacts/{aid}/publish")
    assert resp.status_code == 502
    assert "Facebook" in resp.json()["detail"]


def test_publish_falls_back_to_simulated(incident_id, monkeypatch):
    aid = _approved_artifact(incident_id, "fb_page_post", "fb_page_post")
    monkeypatch.setattr(facebook, "is_configured", lambda: False)

    resp = client.post(f"/v1/artifacts/{aid}/publish")
    assert resp.status_code == 201
    assert resp.json()["connector"] == "simulated"


# ── line real dispatch ─────────────────────────────────────────
def test_broadcast_uses_real_line_when_configured(incident_id, monkeypatch):
    aid = _approved_artifact(incident_id, "line_broadcast", "line_broadcast")
    monkeypatch.setattr(line, "is_configured", lambda: True)

    def fake_broadcast(*, text, quick_replies=None):
        assert text
        return {
            "connector": "line_messaging",
            "status": "published",
            "external_ref": "req-123",
            "url": None,
            "detail": "ok",
        }

    monkeypatch.setattr(line, "broadcast", fake_broadcast)

    resp = client.post(f"/v1/artifacts/{aid}/publish", json={"channel": "line"})
    assert resp.status_code == 201, resp.text
    assert resp.json()["connector"] == "line_messaging"


# ── google forms ───────────────────────────────────────────────
def test_google_form_simulated_by_default(incident_id):
    aid = _approved_artifact(incident_id, "damage_report_form", "damage_report_form")
    resp = client.post(f"/v1/artifacts/{aid}/google-form")
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["channel"] == "google_form"
    assert body["connector"] == "simulated"
    assert body["external_ref"].startswith("sim-google_form-")


def test_google_form_real_when_configured(incident_id, monkeypatch):
    aid = _approved_artifact(incident_id, "damage_report_form", "damage_report_form")
    monkeypatch.setattr(google_forms, "is_configured", lambda: True)

    def fake_create(*, title, description, fields):
        assert title and isinstance(fields, list) and fields
        return {
            "connector": "google_forms",
            "status": "published",
            "external_ref": "form123",
            "url": "https://docs.google.com/forms/d/form123/viewform",
            "detail": "ok",
        }

    monkeypatch.setattr(google_forms, "create_form", fake_create)

    resp = client.post(f"/v1/artifacts/{aid}/google-form")
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["connector"] == "google_forms"
    assert body["url"].endswith("/viewform")


def test_google_form_rejects_non_form(incident_id):
    aid = _approved_artifact(incident_id, "map_bundle", "map_bundle")
    resp = client.post(f"/v1/artifacts/{aid}/google-form")
    assert resp.status_code == 400
    assert "form" in resp.json()["detail"].lower()


def test_google_form_requires_approval(incident_id):
    client.post(
        f"/v1/bootstrap/incidents/{incident_id}",
        params={"module_ids": ["damage_report_form"]},
    )
    aid = client.get(
        "/v1/artifacts",
        params={"incident_id": incident_id, "artifact_type": "damage_report_form"},
    ).json()["items"][0]["id"]
    resp = client.post(f"/v1/artifacts/{aid}/google-form")
    assert resp.status_code == 400
    assert "approved" in resp.json()["detail"]
