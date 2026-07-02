"""Integration tests for the deliverables (outcome) read-model."""
from __future__ import annotations

import uuid

from fastapi.testclient import TestClient

from main import app

client = TestClient(app)


def _create_incident() -> tuple[str, str]:
    unique = uuid.uuid4().hex[:8]
    resp = client.post(
        "/v1/events/alerts",
        json={
            "source": "manual",
            "event_type": "barrier_lake_alert",
            "title": f"成果測試-{unique}",
            "severity": "high",
            "location": {"county": "花蓮縣", "town": "光復鄉", "river": "馬太鞍溪"},
            "source_refs": [{"source_name": "manual", "source_ref": f"mock://{unique}"}],
        },
    )
    assert resp.status_code == 201, resp.text
    body = resp.json()
    return body["incident_id"], body["slug"]


def _deliverables(incident_id: str) -> dict:
    r = client.get(f"/v1/incidents/{incident_id}/deliverables")
    assert r.status_code == 200, r.text
    return r.json()


def _by_key(items: list[dict]) -> dict[str, dict]:
    return {it["key"]: it for it in items}


def test_deliverables_missing_incident_404():
    r = client.get(f"/v1/incidents/{uuid.uuid4()}/deliverables")
    assert r.status_code == 404
    assert r.json()["detail"] == "Incident not found"


def test_deliverables_all_empty_before_bootstrap():
    iid, slug = _create_incident()
    data = _deliverables(iid)
    assert data["incident_id"] == iid
    items = _by_key(data["items"])
    # the six fixed outcomes are always returned
    assert set(items) == {
        "rescue_site",
        "fb_page",
        "line_channel",
        "supply_ops",
        "volunteer_ops",
        "eoc_ops",
    }
    for it in items.values():
        assert it["status"] == "empty"
        assert it["generated_count"] == 0

    # front/admin URLs are resolved for this incident
    assert items["rescue_site"]["front"]["url"] == f"/preview/{slug}"
    assert items["rescue_site"]["admin"]["url"] == f"/incidents/{iid}/site"
    assert items["fb_page"]["admin"]["url"] == f"/incidents/{iid}/fb"
    assert items["fb_page"]["front"]["kind"] == "external_pending"


def test_deliverables_rollup_in_review_then_ready():
    iid, _ = _create_incident()
    # default bootstrap generates the six core modules (all pending_review)
    client.post(f"/v1/bootstrap/incidents/{iid}")

    items = _by_key(_deliverables(iid)["items"])
    site = items["rescue_site"]
    # of the six core modules, four belong to the rescue site (microsite,
    # notice, damage form, map); volunteer/supply forms go to their own
    # deliverables. all are pending => in_review.
    assert site["generated_count"] == 4
    assert site["pending_count"] == 4
    assert site["status"] == "in_review"
    # the other two core modules surface under their own deliverables
    assert items["volunteer_ops"]["generated_count"] >= 1
    assert items["supply_ops"]["generated_count"] >= 1

    # approve every pending review for this incident
    reviews = client.get("/v1/reviews", params={"incident_id": iid, "limit": 100}).json()[
        "items"
    ]
    for rv in reviews:
        client.post(f"/v1/reviews/{rv['id']}/approve", json={})

    site = _by_key(_deliverables(iid)["items"])["rescue_site"]
    assert site["pending_count"] == 0
    assert site["approved_count"] >= 1
    assert site["status"] == "ready"


def test_deliverables_partition_covers_every_generator():
    """Every executable generator module belongs to exactly one deliverable."""
    from app.modules import registry
    from app.modules.deliverables import DELIVERABLES

    members: list[str] = [m for spec in DELIVERABLES for m in spec.members]
    # no module assigned to two deliverables
    assert len(members) == len(set(members))

    generators = {
        s.id for s in registry.all() if s.is_bootstrap_executable()
    }
    assert generators == set(members)
