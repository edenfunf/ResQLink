"""Open-data connector tests — official payload -> standard incident
(need a live database). Runs offline using built-in sample payloads."""
from __future__ import annotations

import uuid

from fastapi.testclient import TestClient

from main import app

client = TestClient(app)


def _incident(iid: str) -> dict:
    r = client.get(f"/v1/incidents/{iid}")
    assert r.status_code == 200, r.text
    return r.json()


def test_list_connectors():
    items = client.get("/v1/connectors").json()["items"]
    by_id = {c["id"]: c for c in items}
    assert {"cwa_earthquake", "ncdr_cap", "data_gov_tw"}.issubset(by_id)
    assert by_id["cwa_earthquake"]["source_type"] == "alert"
    assert by_id["data_gov_tw"]["source_type"] == "dataset"
    # no CWA key in CI -> live disabled, but a sample exists
    assert by_id["cwa_earthquake"]["live_enabled"] is False
    assert by_id["cwa_earthquake"]["has_sample"] is True


def test_cwa_demo_runs():
    # built-in sample uses a fixed source_ref → created on first run, skipped after
    res = client.post("/v1/connectors/cwa_earthquake/demo").json()
    assert res["created_count"] + res["skipped"] == 1
    assert res["failed"] == 0


def test_cwa_ingest_maps_fields():
    no = f"t{uuid.uuid4().hex[:10]}"
    payload = {
        "records": {
            "Earthquake": [
                {
                    "EarthquakeNo": no,
                    "EarthquakeInfo": {
                        "Epicenter": {
                            "Location": "花蓮縣壽豐鄉附近",
                            "EpicenterLatitude": 23.86,
                            "EpicenterLongitude": 121.55,
                        },
                        "EarthquakeMagnitude": {"MagnitudeValue": 6.2},
                    },
                }
            ]
        },
    }
    out = client.post("/v1/connectors/cwa_earthquake/ingest", json={"payload": payload}).json()
    assert out["created_count"] == 1
    inc = _incident(out["created"][0])
    assert inc["scenario_type"] == "earthquake"
    assert inc["severity"] == "critical"  # mag 6.2
    assert inc["location"]["county"] == "花蓮縣"
    assert inc["location"]["lat"] == 23.86
    assert any(r["source_ref"] == f"cwa-eq-{no}" for r in inc["source_refs"])


def test_cwa_ingest_is_idempotent():
    no = f"t{uuid.uuid4().hex[:10]}"
    payload = {
        "records": {
            "Earthquake": [
                {
                    "EarthquakeNo": no,
                    "EarthquakeInfo": {
                        "Epicenter": {"Location": "宜蘭縣外海", "EpicenterLatitude": 24.7, "EpicenterLongitude": 122.0},
                        "EarthquakeMagnitude": {"MagnitudeValue": 4.5},
                    },
                }
            ]
        }
    }
    first = client.post("/v1/connectors/cwa_earthquake/ingest", json={"payload": payload}).json()
    assert first["created_count"] == 1
    again = client.post("/v1/connectors/cwa_earthquake/ingest", json={"payload": payload}).json()
    assert again["created_count"] == 0
    assert again["skipped"] == 1


def test_ncdr_cap_maps_typhoon_and_flood():
    cap = {
        "identifier": f"NCDR-{uuid.uuid4().hex[:10]}",
        "sent": "2026-06-17T07:30:00+08:00",
        "info": [
            {"event": "颱風警報", "severity": "Extreme", "headline": "強颱來襲",
             "area": [{"areaDesc": "花蓮縣", "polygon": "23.6,121.4 23.6,121.7 24.0,121.7 24.0,121.4 23.6,121.4"}]},
            {"event": "大雨特報", "severity": "Moderate", "headline": "光復大雨",
             "area": [{"areaDesc": "花蓮縣光復鄉"}]},
        ],
    }
    out = client.post("/v1/connectors/ncdr_cap/ingest", json={"payload": cap}).json()
    assert out["created_count"] == 2
    incs = [_incident(i) for i in out["created"]]
    scenarios = {i["scenario_type"] for i in incs}
    assert scenarios == {"typhoon", "flood"}
    typhoon = next(i for i in incs if i["scenario_type"] == "typhoon")
    assert typhoon["severity"] == "critical"  # Extreme
    assert typhoon["aoi"] and typhoon["aoi"]["type"] == "Polygon"


def test_unknown_connector_404():
    assert client.post("/v1/connectors/nope/demo").status_code == 404


def test_dataset_connector_not_ingestable():
    resp = client.post("/v1/connectors/data_gov_tw/demo")
    assert resp.status_code == 400


def test_sync_without_key_503():
    resp = client.post("/v1/connectors/cwa_earthquake/sync")
    assert resp.status_code == 503
    assert "not configured" in resp.json()["detail"] or "configured" in resp.json()["detail"]
