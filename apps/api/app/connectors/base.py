"""Shared helpers for open-data connectors.

A connector's job is narrow: turn a *source's native payload* into the system's
standard alert shape (the same fields as AlertEventCreate) so the existing
incident pipeline can consume it. Mapping is pure + deterministic (offline
testable); live fetching is a thin, optional layer on top.
"""
from __future__ import annotations


class ConnectorError(Exception):
    """A real outbound connector was configured but the live call failed.

    Carries a human-readable reason so the API can surface why a real publish /
    form-creation did not go through (as opposed to the simulated fallback, which
    never raises)."""

    def __init__(self, reason: str) -> None:
        super().__init__(reason)
        self.reason = reason


def magnitude_to_severity(mag: float | None) -> str:
    if mag is None:
        return "medium"
    if mag >= 6.0:
        return "critical"
    if mag >= 5.0:
        return "high"
    if mag >= 4.0:
        return "medium"
    return "low"


# CAP <severity> -> our severity
_CAP_SEVERITY = {
    "extreme": "critical",
    "severe": "high",
    "moderate": "medium",
    "minor": "low",
}


def cap_severity(value: str | None) -> str:
    if not value:
        return "medium"
    return _CAP_SEVERITY.get(value.strip().lower(), "medium")


# keyword -> scenario_type, for free-text event/headline classification
_SCENARIO_KEYWORDS: list[tuple[str, tuple[str, ...]]] = [
    ("earthquake", ("地震", "earthquake", "餘震")),
    ("typhoon", ("颱風", "台风", "typhoon", "熱帶氣旋")),
    ("barrier_lake", ("堰塞湖", "barrier")),
    ("flood", ("淹水", "水災", "洪水", "豪雨", "大雨", "積水", "flood", "土石流")),
]


def classify_scenario(text: str | None, default: str = "generic") -> str:
    if not text:
        return default
    low = text.lower()
    for scenario, kws in _SCENARIO_KEYWORDS:
        if any(kw.lower() in low for kw in kws):
            return scenario
    return default


def cap_polygon_to_geojson(polygon: str | None) -> dict | None:
    """CAP <polygon> is 'lat,lon lat,lon ...'. GeoJSON wants [[lon,lat],...]."""
    if not polygon or not polygon.strip():
        return None
    coords = []
    for pair in polygon.strip().split():
        try:
            lat_s, lon_s = pair.split(",")
            coords.append([float(lon_s), float(lat_s)])
        except ValueError:
            return None
    if len(coords) < 4:
        return None
    if coords[0] != coords[-1]:
        coords.append(coords[0])
    return {"type": "Polygon", "coordinates": [coords]}


def make_alert(
    *,
    event_type: str,
    title: str,
    severity: str,
    source_name: str,
    source_ref: str,
    county: str | None = None,
    town: str | None = None,
    river: str | None = None,
    lat: float | None = None,
    lon: float | None = None,
    aoi: dict | None = None,
    fetched_at: str | None = None,
) -> dict:
    """Build a dict shaped like AlertEventCreate (+ aoi) for the incident pipeline."""
    return {
        "source": source_name,
        "event_type": event_type,
        "title": title,
        "severity": severity,
        "location": {
            "county": county,
            "town": town,
            "river": river,
            "lat": lat,
            "lon": lon,
        },
        "aoi": aoi,
        "source_refs": [
            {
                "source_name": source_name,
                "source_ref": source_ref,
                "fetched_at": fetched_at,
            }
        ],
    }
