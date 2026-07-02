"use client";

// Public rescue-portal map. Touches `window`, so import via next/dynamic
// with { ssr: false }. A light civic basemap with toggleable layers:
// citizen reports (by triage), shelters, medical stations, supply drops
// and volunteer teams.

import { useMemo, useState } from "react";
import L from "leaflet";
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Circle,
  Marker,
  Popup,
  GeoJSON,
} from "react-leaflet";
import type {
  GeoJSONFeatureCollection,
  Location,
  ResourceOfferItem,
} from "@/lib/types";
import type { DemoMedical, DemoShelter } from "@/lib/demoContent";
import {
  NEED_LABEL,
  PRIORITY,
  REPORT_STATUS_LABEL,
  MEDICAL_COLOR,
  SHELTER_COLOR,
  SUPPLY_COLOR as SUPPLY_C,
  VOLUNTEER_COLOR as VOLUNTEER_C,
} from "@/lib/rescue";

function priorityOf(props: Record<string, any>): string {
  return props?.triage_priority || props?.severity || "normal";
}

// square glyph pin rendered as a divIcon（收 / 醫 / 資 / 工）
function glyphIcon(glyph: string, color: string) {
  return L.divIcon({
    className: "",
    html: `<div style="display:grid;place-items:center;width:24px;height:24px;border-radius:5px;
      background:${color};color:#fff;font-size:12px;font-weight:700;
      box-shadow:0 1px 3px rgba(0,0,0,.4);border:1.5px solid #fff;">${glyph}</div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -12],
  });
}
const SUPPLY_ICON = glyphIcon("資", SUPPLY_C);
const VOLUNTEER_ICON = glyphIcon("工", VOLUNTEER_C);
const SHELTER_ICON = glyphIcon("收", SHELTER_COLOR);
const MEDICAL_ICON = glyphIcon("醫", MEDICAL_COLOR);

export interface RescueMapProps {
  center?: Location | { lat?: number | null; lon?: number | null } | null;
  aoi?: Record<string, unknown> | null;
  reportsGeoJson?: GeoJSONFeatureCollection | null;
  resources?: ResourceOfferItem[];
  shelters?: DemoShelter[];
  medical?: DemoMedical[];
  height?: number;
}

type LayerKey = "reports" | "shelters" | "medical" | "supply" | "volunteer";

export default function RescueMap({
  center,
  aoi,
  reportsGeoJson,
  resources = [],
  shelters = [],
  medical = [],
  height = 560,
}: RescueMapProps) {
  const lat = center?.lat ?? null;
  const lon = center?.lon ?? null;
  const hasCenter = typeof lat === "number" && typeof lon === "number";
  const aoiKey = useMemo(() => JSON.stringify(aoi ?? {}), [aoi]);
  const features = reportsGeoJson?.features ?? [];

  const supply = resources.filter(
    (r) => r.offer_type === "supply" && r.lat != null && r.lon != null
  );
  const volunteer = resources.filter(
    (r) => r.offer_type === "volunteer" && r.lat != null && r.lon != null
  );

  const [show, setShow] = useState<Record<LayerKey, boolean>>({
    reports: true,
    shelters: true,
    medical: true,
    supply: false,
    volunteer: false,
  });
  const toggle = (k: LayerKey) => setShow((s) => ({ ...s, [k]: !s[k] }));

  if (!hasCenter) {
    return (
      <div
        style={{ height }}
        className="flex items-center justify-center border border-dashed border-slate-300 bg-slate-50 text-sm text-slate-500"
      >
        此事件沒有中心座標，無法顯示地圖。
      </div>
    );
  }

  return (
    <div
      className="relative overflow-hidden border border-slate-300"
      style={{ height }}
    >
      <MapContainer
        center={[lat as number, lon as number]}
        zoom={13}
        scrollWheelZoom={false}
        style={{ height: "100%", width: "100%", background: "#e8ecef" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        />

        {/* affected-area ring (fallback to a radius when there is no AOI polygon) */}
        {aoi ? (
          <GeoJSON
            key={aoiKey}
            data={aoi as any}
            style={{ color: "#dc2626", weight: 1.5, fillOpacity: 0.05, dashArray: "6 4" }}
          />
        ) : (
          <Circle
            center={[lat as number, lon as number]}
            radius={2600}
            pathOptions={{ color: "#dc2626", weight: 1.2, opacity: 0.6, fillColor: "#dc2626", fillOpacity: 0.05, dashArray: "4 5" }}
          />
        )}

        {/* incident centre */}
        <CircleMarker
          center={[lat as number, lon as number]}
          radius={6}
          pathOptions={{ color: "#fff", weight: 2.5, fillColor: "#1d4ed8", fillOpacity: 1 }}
        >
          <Popup>事件中心</Popup>
        </CircleMarker>

        {/* citizen reports */}
        {show.reports &&
          features.map((f, i) => {
            const [flon, flat] = f.geometry.coordinates;
            const props = f.properties ?? {};
            const p = priorityOf(props);
            const col = (PRIORITY[p] || PRIORITY.normal).c;
            const isCritical = p === "critical";
            const need = NEED_LABEL[props.need_type] || props.need_type;
            return (
              <CircleMarker
                key={props.report_id ?? i}
                center={[flat, flon]}
                radius={isCritical ? 10 : p === "high" ? 8 : 6}
                pathOptions={{ color: "#fff", weight: 1.5, fillColor: col, fillOpacity: 0.85 }}
              >
                <Popup>
                  <div className="text-xs leading-relaxed">
                    <div className="text-sm font-semibold text-slate-900">
                      {need}
                      <span className="ml-1.5 font-normal" style={{ color: col }}>
                        {(PRIORITY[p] || PRIORITY.normal).label}
                      </span>
                    </div>
                    {props.description ? <div className="mt-0.5">{props.description}</div> : null}
                    {props.address ? <div className="text-slate-500">{props.address}</div> : null}
                    <div className="text-slate-500">
                      狀態：{REPORT_STATUS_LABEL[props.status] || props.status}
                    </div>
                  </div>
                </Popup>
              </CircleMarker>
            );
          })}

        {/* shelters */}
        {show.shelters &&
          shelters.map((s, i) => (
            <Marker key={`sh-${i}`} position={[s.lat, s.lon]} icon={SHELTER_ICON}>
              <Popup>
                <div className="text-xs leading-relaxed">
                  <div className="text-sm font-semibold text-slate-900">{s.name}</div>
                  <div>收容 {s.current} / {s.capacity} 人</div>
                  <div className="text-slate-500">{s.address}</div>
                  <div className="text-slate-500">電話 {s.phone}</div>
                </div>
              </Popup>
            </Marker>
          ))}

        {/* medical stations */}
        {show.medical &&
          medical.map((m, i) => (
            <Marker key={`md-${i}`} position={[m.lat, m.lon]} icon={MEDICAL_ICON}>
              <Popup>
                <div className="text-xs leading-relaxed">
                  <div className="text-sm font-semibold text-slate-900">{m.name}</div>
                  <div>{m.services}</div>
                  <div className="text-slate-500">服務時間 {m.hours}</div>
                </div>
              </Popup>
            </Marker>
          ))}

        {/* supply drops */}
        {show.supply &&
          supply.map((s) => (
            <Marker key={s.id} position={[s.lat as number, s.lon as number]} icon={SUPPLY_ICON}>
              <Popup>
                <div className="text-xs leading-relaxed">
                  <div className="text-sm font-semibold text-slate-900">物資 · {s.item}</div>
                  {s.quantity != null ? <div>數量：{s.quantity}</div> : null}
                  {s.provider_name ? <div>提供：{s.provider_name}</div> : null}
                  {s.available_time ? <div>時間：{s.available_time}</div> : null}
                </div>
              </Popup>
            </Marker>
          ))}

        {/* volunteer teams */}
        {show.volunteer &&
          volunteer.map((v) => (
            <Marker key={v.id} position={[v.lat as number, v.lon as number]} icon={VOLUNTEER_ICON}>
              <Popup>
                <div className="text-xs leading-relaxed">
                  <div className="text-sm font-semibold text-slate-900">志工 · {v.item}</div>
                  {v.quantity != null ? <div>人數：{v.quantity}</div> : null}
                  {v.provider_name ? <div>隊伍：{v.provider_name}</div> : null}
                  {v.available_time ? <div>時間：{v.available_time}</div> : null}
                </div>
              </Popup>
            </Marker>
          ))}
      </MapContainer>

      {/* layer toggles */}
      <div className="absolute right-2.5 top-2.5 z-[1000] flex flex-col items-end gap-1.5">
        <div className="flex flex-wrap justify-end gap-1.5">
          <LayerChip on={show.reports} c="#dc2626" label={`災情 ${features.length}`} onClick={() => toggle("reports")} />
          <LayerChip on={show.shelters} c={SHELTER_COLOR} label={`收容所 ${shelters.length}`} onClick={() => toggle("shelters")} />
          <LayerChip on={show.medical} c={MEDICAL_COLOR} label={`醫療 ${medical.length}`} onClick={() => toggle("medical")} />
          <LayerChip on={show.supply} c={SUPPLY_C} label={`物資點 ${supply.length}`} onClick={() => toggle("supply")} />
          <LayerChip on={show.volunteer} c={VOLUNTEER_C} label={`志工 ${volunteer.length}`} onClick={() => toggle("volunteer")} />
        </div>
      </div>

      {/* legend */}
      <div className="pointer-events-none absolute bottom-2.5 left-2.5 z-[1000] border border-slate-300 bg-white/95 px-3 py-2 text-[11px] text-slate-700 shadow-sm">
        <div className="mb-1 font-semibold text-slate-900">通報優先序</div>
        <div className="flex flex-col gap-0.5">
          {[["critical", "危急"], ["high", "高"], ["normal", "一般"], ["low", "低"]].map(([k, lbl]) => (
            <span key={k} className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-full border border-white" style={{ background: PRIORITY[k].c }} />
              {lbl}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function LayerChip({
  on, c, label, onClick,
}: {
  on: boolean; c: string; label: string; onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1.5 border px-2 py-1 text-[11px] font-medium shadow-sm transition"
      style={{
        background: on ? "#fff" : "rgba(255,255,255,.7)",
        color: on ? "#1e293b" : "#94a3b8",
        borderColor: on ? c : "#cbd5e1",
      }}
    >
      <span className="inline-block h-2 w-2 rounded-full" style={{ background: on ? c : "#cbd5e1" }} />
      {label}
    </button>
  );
}
