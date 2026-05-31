"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import { api } from "@/lib/api";
import type { CreateIncidentPayload, Severity } from "@/lib/types";

const SAMPLE_AOI = JSON.stringify(
  {
    type: "Polygon",
    coordinates: [
      [
        [121.4, 23.65],
        [121.45, 23.65],
        [121.45, 23.69],
        [121.4, 23.69],
        [121.4, 23.65],
      ],
    ],
  },
  null,
  2
);

const SEVERITY_OPTIONS: { value: Severity; label: string }[] = [
  { value: "low", label: "低" },
  { value: "medium", label: "中" },
  { value: "high", label: "高" },
  { value: "critical", label: "極高" },
];

export default function NewIncidentPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    title: "馬太鞍溪堰塞湖警戒事件",
    severity: "high" as Severity,
    county: "花蓮縣",
    town: "光復鄉",
    river: "馬太鞍溪",
    lat: "23.66",
    lon: "121.42",
    aoi: SAMPLE_AOI,
    source_ref: "mock://mataian-alert-001",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);

    let aoi: Record<string, unknown> | null = null;
    if (form.aoi.trim()) {
      try {
        aoi = JSON.parse(form.aoi);
      } catch {
        setError("AOI 不是有效的 JSON，請檢查格式。");
        setBusy(false);
        return;
      }
    }

    const payload: CreateIncidentPayload = {
      source: "manual",
      event_type: "barrier_lake_alert",
      title: form.title.trim(),
      severity: form.severity,
      location: {
        county: form.county.trim() || null,
        town: form.town.trim() || null,
        river: form.river.trim() || null,
        lat: form.lat.trim() ? Number(form.lat) : null,
        lon: form.lon.trim() ? Number(form.lon) : null,
      },
      aoi,
      source_refs: form.source_ref.trim()
        ? [{ source_name: "manual", source_ref: form.source_ref.trim() }]
        : [],
    };

    try {
      const res = await api.createIncident(payload);
      router.push(`/incidents/${res.incident_id}`);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl">
        <Link
          href="/console"
          className="text-sm text-stone-400 transition hover:text-stone-700"
        >
          ← 返回管理台
        </Link>
        <span className="db-eyebrow mt-4 block">New Incident</span>
        <h1 className="font-display mt-1 text-2xl font-semibold tracking-tight text-stone-900">
          建立事件
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-stone-500">
          <code className="db-chip">event_type=barrier_lake_alert</code>{" "}
          與 <code className="db-chip">source=manual</code> 為固定值。
          表單已預填馬太鞍溪情境，可直接送出。
        </p>

        <form onSubmit={handleSubmit} className="db-card mt-6 space-y-5 p-6">
          <div>
            <label className="db-label">事件標題</label>
            <input
              className="db-input"
              required
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="db-label">嚴重程度</label>
              <select
                className="db-input"
                value={form.severity}
                onChange={(e) => set("severity", e.target.value)}
              >
                {SEVERITY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="db-label">河川</label>
              <input
                className="db-input"
                value={form.river}
                onChange={(e) => set("river", e.target.value)}
              />
            </div>
            <div>
              <label className="db-label">縣市</label>
              <input
                className="db-input"
                value={form.county}
                onChange={(e) => set("county", e.target.value)}
              />
            </div>
            <div>
              <label className="db-label">鄉鎮市區</label>
              <input
                className="db-input"
                value={form.town}
                onChange={(e) => set("town", e.target.value)}
              />
            </div>
            <div>
              <label className="db-label">緯度 lat</label>
              <input
                className="db-input"
                value={form.lat}
                onChange={(e) => set("lat", e.target.value)}
                inputMode="decimal"
              />
            </div>
            <div>
              <label className="db-label">經度 lon</label>
              <input
                className="db-input"
                value={form.lon}
                onChange={(e) => set("lon", e.target.value)}
                inputMode="decimal"
              />
            </div>
          </div>

          <div>
            <label className="db-label">影響範圍 AOI（GeoJSON Polygon）</label>
            <textarea
              className="db-input font-mono text-xs"
              rows={8}
              value={form.aoi}
              onChange={(e) => set("aoi", e.target.value)}
            />
          </div>

          <div>
            <label className="db-label">來源 source_ref</label>
            <input
              className="db-input"
              value={form.source_ref}
              onChange={(e) => set("source_ref", e.target.value)}
            />
          </div>

          {error ? (
            <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-inset ring-rose-100">
              {error}
            </p>
          ) : null}

          <button type="submit" disabled={busy} className="db-btn db-btn-primary w-full">
            {busy ? "建立中…" : "建立事件"}
          </button>
        </form>
      </div>
    </AppShell>
  );
}
