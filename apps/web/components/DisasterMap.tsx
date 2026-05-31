"use client";

// Touches `window`, so import via next/dynamic with { ssr: false }.

import { useMemo } from "react";
import L from "leaflet";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  GeoJSON,
  CircleMarker,
} from "react-leaflet";
import type {
  GeoJSONFeatureCollection,
  Location,
} from "@/lib/types";

// Next can't resolve the bundled marker PNGs, so point at the CDN copies.
const markerIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

export interface DisasterMapProps {
  center?: Location | { lat?: number | null; lon?: number | null } | null;
  aoi?: Record<string, unknown> | null;
  reportsGeoJson?: GeoJSONFeatureCollection | null;
  height?: number;
}

export default function DisasterMap({
  center,
  aoi,
  reportsGeoJson,
  height = 360,
}: DisasterMapProps) {
  const lat = center?.lat ?? null;
  const lon = center?.lon ?? null;
  const hasCenter = typeof lat === "number" && typeof lon === "number";

  const reportCount = reportsGeoJson?.features?.length ?? 0;

  // Key change forces the GeoJSON layer to remount when the AOI changes.
  const aoiKey = useMemo(() => JSON.stringify(aoi ?? {}), [aoi]);

  if (!hasCenter) {
    return (
      <div
        style={{ height }}
        className="flex items-center justify-center rounded-lg border border-dashed border-stone-300 bg-stone-50 text-sm text-stone-500"
      >
        此事件沒有中心座標，無法顯示地圖。
      </div>
    );
  }

  return (
    <div
      className="overflow-hidden rounded-lg border border-stone-200"
      style={{ height }}
    >
      <MapContainer
        center={[lat as number, lon as number]}
        zoom={13}
        scrollWheelZoom={false}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <Marker position={[lat as number, lon as number]} icon={markerIcon}>
          <Popup>事件中心點</Popup>
        </Marker>

        {aoi ? (
          <GeoJSON
            key={aoiKey}
            data={aoi as any}
            style={{ color: "#ea580c", weight: 2, fillOpacity: 0.1 }}
          />
        ) : null}

        {reportsGeoJson?.features?.map((f, i) => {
          const [flon, flat] = f.geometry.coordinates;
          return (
            <CircleMarker
              key={f.properties?.report_id ?? i}
              center={[flat, flon]}
              radius={8}
              pathOptions={{
                color: "#2563eb",
                fillColor: "#3b82f6",
                fillOpacity: 0.8,
              }}
            >
              <Popup>
                <div className="text-xs">
                  <div className="font-semibold">
                    {f.properties?.need_type}
                  </div>
                  <div>嚴重度：{f.properties?.severity}</div>
                  <div>狀態：{f.properties?.status}</div>
                  {f.properties?.address ? (
                    <div>地點：{f.properties.address}</div>
                  ) : null}
                </div>
              </Popup>
            </CircleMarker>
          );
        })}
      </MapContainer>
      <div className="border-t border-stone-200 bg-white px-3 py-1.5 text-xs text-stone-500">
        通報點：{reportCount} 筆（僅顯示有座標者）
      </div>
    </div>
  );
}
