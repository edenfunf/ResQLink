"""NCDR (National Science and Technology Center for Disaster Reduction)
disaster-alert connector.

NCDR publishes multi-hazard alerts in CAP (Common Alerting Protocol) — typhoon,
heavy rain/flood, landslide, etc. We accept CAP JSON (a CAP XML can be converted
upstream) and map each <info> block to a standard alert.
"""
from __future__ import annotations

from app.connectors.base import (
    cap_polygon_to_geojson,
    cap_severity,
    classify_scenario,
    make_alert,
)

# scenario_type -> our supported alert event_type
_EVENT_TYPE = {
    "earthquake": "earthquake_alert",
    "typhoon": "typhoon_alert",
    "flood": "flood_alert",
    "barrier_lake": "barrier_lake_alert",
    "generic": "flood_alert",  # fallback: treat unknown hazard as a flood-type alert
}


def map_cap(payload: dict) -> list[dict]:
    """CAP alert payload (JSON) -> alert dicts. Supports one alert with a list of
    info blocks, or a list of alerts."""
    alerts_in = payload if isinstance(payload, list) else [payload]
    out: list[dict] = []
    for alert in alerts_in:
        identifier = (alert or {}).get("identifier") or (alert or {}).get("id") or "ncdr"
        infos = alert.get("info", [])
        if isinstance(infos, dict):
            infos = [infos]
        for idx, info in enumerate(infos):
            event = info.get("event") or info.get("headline") or ""
            headline = info.get("headline") or event
            scenario = classify_scenario(f"{event} {headline}")
            areas = info.get("area", [])
            if isinstance(areas, dict):
                areas = [areas]
            area = areas[0] if areas else {}
            out.append(
                make_alert(
                    event_type=_EVENT_TYPE.get(scenario, "flood_alert"),
                    title=headline or event or "災害示警",
                    severity=cap_severity(info.get("severity")),
                    source_name="ncdr",
                    source_ref=f"{identifier}#{idx}",
                    county=area.get("areaDesc"),
                    aoi=cap_polygon_to_geojson(area.get("polygon")),
                    fetched_at=alert.get("sent"),
                )
            )
    return out


def fetch_cap() -> list[dict]:
    """Placeholder for live NCDR CAP fetch. Returns [] (NCDR feed URL/format is
    deployment-specific; wire the real endpoint here)."""
    return []


# A representative NCDR CAP payload (typhoon + heavy-rain) for demo/tests.
SAMPLE_CAP: dict = {
    "identifier": "NCDR-2026-0617-0001",
    "sender": "ncdr.nat.gov.tw",
    "sent": "2026-06-17T07:30:00+08:00",
    "status": "Actual",
    "msgType": "Alert",
    "info": [
        {
            "event": "颱風警報",
            "severity": "Severe",
            "certainty": "Likely",
            "headline": "強烈颱風海葵接近，花蓮地區發布陸上颱風警報",
            "description": "預計未來 24 小時內影響東部地區，請加強防颱準備。",
            "area": [
                {
                    "areaDesc": "花蓮縣",
                    "polygon": "23.6,121.4 23.6,121.7 24.0,121.7 24.0,121.4 23.6,121.4",
                }
            ],
        },
        {
            "event": "大雨特報",
            "severity": "Moderate",
            "certainty": "Observed",
            "headline": "光復鄉及鄰近地區發布大雨特報，慎防積淹水",
            "area": [{"areaDesc": "花蓮縣光復鄉"}],
        },
    ],
}
