"""Rough county centroids so an incident always has a map centre, even when it
was created from natural language (agent flow) without coordinates."""
from __future__ import annotations

# (lat, lon) approximate centroids for Taiwan counties/cities.
COUNTY_CENTROIDS: dict[str, tuple[float, float]] = {
    "台北市": (25.03, 121.56),
    "新北市": (25.01, 121.46),
    "基隆市": (25.13, 121.74),
    "桃園市": (24.99, 121.30),
    "新竹市": (24.80, 120.97),
    "新竹縣": (24.70, 121.12),
    "苗栗縣": (24.56, 120.82),
    "台中市": (24.15, 120.68),
    "彰化縣": (24.05, 120.52),
    "南投縣": (23.91, 120.69),
    "雲林縣": (23.71, 120.43),
    "嘉義市": (23.48, 120.45),
    "嘉義縣": (23.46, 120.29),
    "台南市": (23.00, 120.20),
    "高雄市": (22.63, 120.30),
    "屏東縣": (22.55, 120.55),
    "宜蘭縣": (24.70, 121.74),
    "花蓮縣": (23.99, 121.60),
    "台東縣": (22.79, 121.11),
    "澎湖縣": (23.57, 119.58),
    "金門縣": (24.43, 118.32),
    "連江縣": (26.16, 119.95),
}

# geographic centre of Taiwan, used as a last resort
TAIWAN_CENTER = (23.75, 121.0)


def _normalize(name: str | None) -> str:
    return (name or "").replace("臺", "台").strip()


def centroid_for(county: str | None) -> tuple[float, float] | None:
    """Return an approximate (lat, lon) for a county name, or None."""
    return COUNTY_CENTROIDS.get(_normalize(county))
