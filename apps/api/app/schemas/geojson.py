"""Minimal RFC 7946 subset for Point FeatureCollections; PII is never modelled."""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class GeoJSONPoint(BaseModel):
    type: Literal["Point"] = "Point"
    coordinates: list[float] = Field(
        ..., description="[lon, lat] order per GeoJSON spec"
    )


class GeoJSONFeature(BaseModel):
    type: Literal["Feature"] = "Feature"
    geometry: GeoJSONPoint
    properties: dict


class GeoJSONFeatureCollection(BaseModel):
    type: Literal["FeatureCollection"] = "FeatureCollection"
    features: list[GeoJSONFeature]
