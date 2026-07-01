"""Central Weather Administration (CWA) open-data connector.

Earthquake reports have a stable, well-documented shape, so we map them
confidently. Live fetch needs a free authorization key (CWA_API_KEY); without a
key the mapper still works on any payload you POST (ingest/demo).
"""
from __future__ import annotations

import re

from app.connectors.base import magnitude_to_severity, make_alert
from app.core.config import settings

# CWA dataset: 顯著有感地震報告
_EARTHQUAKE_DATASET = "E-A0015-001"

_COUNTY_RE = re.compile(r"([一-鿿]{1,3}[縣市])")


def is_live_enabled() -> bool:
    return bool(settings.CWA_API_KEY)


def _county_from(location: str | None) -> str | None:
    if not location:
        return None
    m = _COUNTY_RE.search(location)
    return m.group(1) if m else None


def map_earthquake(payload: dict) -> list[dict]:
    """CWA E-A0015 earthquake report payload -> alert dicts."""
    records = (payload or {}).get("records", {})
    quakes = records.get("Earthquake", []) or records.get("earthquake", [])
    alerts: list[dict] = []
    for q in quakes:
        info = q.get("EarthquakeInfo", {})
        epi = info.get("Epicenter", {})
        mag_obj = info.get("EarthquakeMagnitude", {})
        mag = mag_obj.get("MagnitudeValue")
        location = epi.get("Location")
        no = q.get("EarthquakeNo")
        alerts.append(
            make_alert(
                event_type="earthquake_alert",
                title=f"規模 {mag} 地震 — {location}" if location else f"規模 {mag} 地震",
                severity=magnitude_to_severity(
                    float(mag) if isinstance(mag, (int, float, str)) and str(mag).replace(".", "", 1).isdigit() else None
                ),
                source_name="cwa",
                source_ref=f"cwa-eq-{no}",
                county=_county_from(location),
                lat=epi.get("EpicenterLatitude"),
                lon=epi.get("EpicenterLongitude"),
                # OriginTime uses a space separator (not strict ISO) — keep it out
                # of the typed fetched_at; the origin time is already in the title.
                fetched_at=None,
            )
        )
    return alerts


def fetch_earthquake() -> list[dict]:
    """Live fetch + map. Returns [] if no key configured or the call fails."""
    if not is_live_enabled():
        return []
    import httpx

    try:
        resp = httpx.get(
            f"{settings.CWA_API_BASE}/{_EARTHQUAKE_DATASET}",
            params={"Authorization": settings.CWA_API_KEY, "format": "JSON"},
            timeout=15,
        )
        resp.raise_for_status()
        return map_earthquake(resp.json())
    except Exception:
        return []


# A representative CWA earthquake payload (shape per CWA docs) for demo/tests.
SAMPLE_EARTHQUAKE: dict = {
    "success": "true",
    "records": {
        "Earthquake": [
            {
                "EarthquakeNo": 11410006,
                "ReportType": "地震報告",
                "ReportContent": "06/17 08:00 花蓮縣近海發生規模 5.9 有感地震，最大震度花蓮縣 5 弱。",
                "EarthquakeInfo": {
                    "OriginTime": "2026-06-17 08:00:12",
                    "Source": "中央氣象署",
                    "FocalDepth": 18.5,
                    "Epicenter": {
                        "Location": "花蓮縣政府東方 30.6 公里 (位於臺灣東部海域)",
                        "EpicenterLatitude": 23.98,
                        "EpicenterLongitude": 121.95,
                    },
                    "EarthquakeMagnitude": {
                        "MagnitudeType": "芮氏規模",
                        "MagnitudeValue": 5.9,
                    },
                },
            }
        ]
    },
}
