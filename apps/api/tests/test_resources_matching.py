"""Resource offers + needs-resource matching tests (need a live database)."""
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
            "event_type": "flood_alert",
            "title": f"match-{unique}",
            "severity": "high",
            "location": {"county": "花蓮縣", "lat": 23.66, "lon": 121.42},
            "source_refs": [],
        },
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["incident_id"]


def _offer(iid: str, **over) -> dict:
    body = {"offer_type": "supply", "item": "飲用水", "quantity": 100}
    body.update(over)
    r = client.post(f"/v1/incidents/{iid}/resources", json=body)
    return r


def _report(iid: str, **over) -> str:
    body = {"need_type": "supply_need", "description": "需要物資", "severity": "high"}
    body.update(over)
    r = client.post(f"/v1/incidents/{iid}/reports", json=body)
    assert r.status_code == 201, r.text
    return r.json()["report_id"]


@pytest.fixture()
def incident_id() -> str:
    return _create_incident()


# ── resource offers ────────────────────────────────────────────
def test_create_and_list_offer_hides_contact(incident_id):
    resp = _offer(incident_id, provider_name="陳先生", provider_contact="0911222333")
    assert resp.status_code == 201, resp.text
    offer_id = resp.json()["offer_id"]

    listing = client.get(f"/v1/incidents/{incident_id}/resources").json()
    assert listing["total"] == 1
    assert "provider_contact" not in listing["items"][0]
    assert listing["items"][0]["item"] == "飲用水"
    assert listing["items"][0]["id"] == offer_id


def test_offer_coords_must_be_paired(incident_id):
    resp = _offer(incident_id, lat=23.6, lon=None)
    assert resp.status_code == 422


def test_offer_on_missing_incident_404():
    resp = _offer(str(uuid.uuid4()))
    assert resp.status_code == 404


def test_offer_filter_by_type(incident_id):
    _offer(incident_id, offer_type="supply", item="飲用水")
    _offer(incident_id, offer_type="volunteer", item="清淤")
    vols = client.get(
        f"/v1/incidents/{incident_id}/resources", params={"offer_type": "volunteer"}
    ).json()
    assert vols["total"] == 1
    assert vols["items"][0]["offer_type"] == "volunteer"


# ── matching ───────────────────────────────────────────────────
def test_matching_pairs_supply_need_with_supply_offer(incident_id):
    _report(incident_id, need_type="supply_need", lat=23.66, lon=121.42)
    _offer(incident_id, offer_type="supply", item="飲用水", lat=23.66, lon=121.42)
    _offer(incident_id, offer_type="supply", item="乾糧", lat=23.90, lon=121.60)

    m = client.get(f"/v1/incidents/{incident_id}/matches").json()
    assert m["open_offers"] == 2
    assert m["matched_reports"] == 1
    cands = m["items"][0]["candidates"]
    assert len(cands) == 2
    # nearest (distance 0) ranks first
    assert cands[0]["distance_km"] == 0.0
    assert cands[0]["score"] >= cands[1]["score"]


def test_matching_respects_type_compatibility(incident_id):
    # a labour need should NOT match a supply offer
    _report(incident_id, need_type="mud_removal")
    _offer(incident_id, offer_type="supply", item="飲用水")
    m = client.get(f"/v1/incidents/{incident_id}/matches").json()
    assert m["matched_reports"] == 0
    assert m["unmatched_reports"] == 1
    assert m["items"][0]["candidates"] == []


def test_matching_volunteer_for_labour_need(incident_id):
    _report(incident_id, need_type="mud_removal")
    _offer(incident_id, offer_type="volunteer", item="清淤")
    m = client.get(f"/v1/incidents/{incident_id}/matches").json()
    assert m["matched_reports"] == 1
    assert m["items"][0]["candidates"][0]["offer_type"] == "volunteer"


def test_matching_orders_reports_critical_first(incident_id):
    _report(incident_id, need_type="supply_need", severity="low")  # low triage
    _report(incident_id, need_type="trapped_person", severity="critical")  # critical
    _offer(incident_id, offer_type="volunteer", item="搜救協助")

    m = client.get(f"/v1/incidents/{incident_id}/matches").json()
    assert m["items"][0]["triage_priority"] == "critical"


def test_matches_missing_incident_404():
    assert client.get(f"/v1/incidents/{uuid.uuid4()}/matches").status_code == 404


def test_resource_offer_in_timeline(incident_id):
    _offer(incident_id, item="雨鞋")
    types = {
        i["event_type"]
        for i in client.get(f"/v1/incidents/{incident_id}/timeline").json()["items"]
    }
    assert "resource_offer.created" in types


def test_matching_engine_module_now_live():
    by_id = {m["id"]: m for m in client.get("/v1/modules").json()["items"]}
    assert by_id["needs_matching_engine"]["implemented"] is True
    assert "matches" in by_id["needs_matching_engine"]["endpoint"]
