from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

# a plain str (not Literal) so the router returns 400, not Pydantic's 422
SUPPORTED_EVENT_TYPES = ("barrier_lake_alert",)
Severity = Literal["low", "medium", "high", "critical"]


class LocationInput(BaseModel):
    county: str | None = Field(default=None, description="縣市，例如 花蓮縣")
    town: str | None = Field(default=None, description="鄉鎮市區，例如 光復鄉")
    river: str | None = Field(default=None, description="河川名稱，例如 馬太鞍溪")
    lat: float | None = Field(default=None, description="緯度")
    lon: float | None = Field(default=None, description="經度")


class SourceRefInput(BaseModel):
    source_name: str = Field(..., description="來源名稱，例如 manual / cwa")
    source_ref: str = Field(..., description="來源識別，例如 mock://mataian-alert-001")
    fetched_at: datetime | None = Field(
        default=None, description="資料擷取時間 (ISO 8601)"
    )


class AlertEventCreate(BaseModel):
    source: str = Field(..., description="資料來源，例如 manual / official")
    event_type: str = Field(
        ...,
        description="事件類型，目前僅支援 barrier_lake_alert",
        examples=["barrier_lake_alert"],
    )
    title: str = Field(..., min_length=1, description="事件標題")
    severity: Severity = Field(..., description="嚴重程度")
    location: LocationInput = Field(default_factory=LocationInput)
    aoi: dict | None = Field(
        default=None,
        description="影響範圍 (GeoJSON Geometry，例如 Polygon)",
    )
    source_refs: list[SourceRefInput] = Field(default_factory=list)

    model_config = {
        "json_schema_extra": {
            "example": {
                "source": "manual",
                "event_type": "barrier_lake_alert",
                "title": "馬太鞍溪堰塞湖警戒事件",
                "severity": "high",
                "location": {
                    "county": "花蓮縣",
                    "town": "光復鄉",
                    "river": "馬太鞍溪",
                    "lat": 23.66,
                    "lon": 121.42,
                },
                "aoi": {
                    "type": "Polygon",
                    "coordinates": [
                        [
                            [121.40, 23.65],
                            [121.45, 23.65],
                            [121.45, 23.69],
                            [121.40, 23.69],
                            [121.40, 23.65],
                        ]
                    ],
                },
                "source_refs": [
                    {
                        "source_name": "manual",
                        "source_ref": "mock://mataian-alert-001",
                        "fetched_at": "2026-05-31T08:00:00+08:00",
                    }
                ],
            }
        }
    }
