"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import type { NeedType, Severity, SubmitReportPayload } from "@/lib/types";

const NEED_OPTIONS: { value: NeedType; label: string }[] = [
  { value: "flooding", label: "淹水" },
  { value: "mud_removal", label: "清淤" },
  { value: "road_blocked", label: "道路中斷" },
  { value: "trapped_person", label: "受困人員" },
  { value: "medical_need", label: "醫療需求" },
  { value: "supply_need", label: "物資需求" },
  { value: "other", label: "其他" },
];

const SEVERITY_OPTIONS: { value: Severity; label: string }[] = [
  { value: "low", label: "低" },
  { value: "medium", label: "中" },
  { value: "high", label: "高" },
  { value: "critical", label: "極高" },
];

interface FormState {
  reporter_name: string;
  reporter_contact: string;
  need_type: NeedType;
  description: string;
  severity: Severity;
  address: string;
  lat: string;
  lon: string;
}

const EMPTY: FormState = {
  reporter_name: "",
  reporter_contact: "",
  need_type: "mud_removal",
  description: "",
  severity: "high",
  address: "",
  lat: "",
  lon: "",
};

export default function DynamicReportForm({
  incidentId,
  onSubmitted,
  defaultCenter,
}: {
  incidentId: string;
  onSubmitted?: (reportId: string) => void;
  defaultCenter?: { lat?: number | null; lon?: number | null };
}) {
  const [form, setForm] = useState<FormState>({
    ...EMPTY,
    lat: defaultCenter?.lat != null ? String(defaultCenter.lat) : "",
    lon: defaultCenter?.lon != null ? String(defaultCenter.lon) : "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSuccess(null);

    const hasLat = form.lat.trim() !== "";
    const hasLon = form.lon.trim() !== "";
    if (hasLat !== hasLon) {
      setError("緯度與經度必須同時填寫或同時留空。");
      setBusy(false);
      return;
    }

    const payload: SubmitReportPayload = {
      reporter_name: form.reporter_name.trim() || null,
      reporter_contact: form.reporter_contact.trim() || null,
      need_type: form.need_type,
      description: form.description.trim(),
      severity: form.severity,
      address: form.address.trim() || null,
      lat: hasLat ? Number(form.lat) : null,
      lon: hasLon ? Number(form.lon) : null,
    };

    try {
      const res = await api.submitReport(incidentId, payload);
      setSuccess(`通報已送出（report_id: ${res.report_id}）。${res.message}`);
      setForm({ ...EMPTY });
      onSubmitted?.(res.report_id);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="db-card space-y-4 p-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="db-label">通報者姓名</label>
          <input
            className="db-input"
            value={form.reporter_name}
            onChange={(e) => set("reporter_name", e.target.value)}
            placeholder="可留空"
          />
        </div>
        <div>
          <label className="db-label">聯絡方式</label>
          <input
            className="db-input"
            value={form.reporter_contact}
            onChange={(e) => set("reporter_contact", e.target.value)}
            placeholder="可留空（個資，正式環境需保護）"
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="db-label">需求類型</label>
          <select
            className="db-input"
            value={form.need_type}
            onChange={(e) => set("need_type", e.target.value as NeedType)}
          >
            {NEED_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="db-label">嚴重程度</label>
          <select
            className="db-input"
            value={form.severity}
            onChange={(e) => set("severity", e.target.value as Severity)}
          >
            {SEVERITY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="db-label">狀況描述（必填）</label>
        <textarea
          className="db-input"
          rows={3}
          required
          value={form.description}
          onChange={(e) => set("description", e.target.value)}
          placeholder="例如：住家一樓淤泥約 30 公分，需要協助清理"
        />
      </div>

      <div>
        <label className="db-label">地址或地點描述</label>
        <input
          className="db-input"
          value={form.address}
          onChange={(e) => set("address", e.target.value)}
          placeholder="花蓮縣光復鄉某路段"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="db-label">緯度 lat</label>
          <input
            className="db-input"
            value={form.lat}
            onChange={(e) => set("lat", e.target.value)}
            placeholder="23.665（與經度成對）"
            inputMode="decimal"
          />
        </div>
        <div>
          <label className="db-label">經度 lon</label>
          <input
            className="db-input"
            value={form.lon}
            onChange={(e) => set("lon", e.target.value)}
            placeholder="121.421（與緯度成對）"
            inputMode="decimal"
          />
        </div>
      </div>

      {error ? (
        <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-inset ring-rose-100">
          {error}
        </p>
      ) : null}
      {success ? (
        <p
          className="rounded-xl px-3 py-2 text-sm ring-1 ring-inset"
          style={{ background: "#e7ebdd", color: "#4f5b3c", "--tw-ring-color": "#d7dec8" } as React.CSSProperties}
        >
          {success}
        </p>
      ) : null}

      <button type="submit" disabled={busy} className="db-btn db-btn-primary w-full">
        {busy ? "送出中…" : "送出通報"}
      </button>
    </form>
  );
}
