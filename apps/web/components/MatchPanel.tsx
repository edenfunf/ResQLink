"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import type {
  AssignmentItem,
  AssignmentStatus,
  MatchesResponse,
  OfferType,
  ResourceOfferItem,
} from "@/lib/types";
import StatusBadge from "./StatusBadge";

const NEED_LABELS: Record<string, string> = {
  flooding: "淹水",
  mud_removal: "清淤",
  road_blocked: "道路中斷",
  power_outage: "停電停水",
  building_collapse: "建物倒塌",
  fire: "火災",
  gas_leak: "瓦斯外洩",
  trapped_person: "受困人員",
  missing_person: "失蹤協尋",
  medical_need: "醫療需求",
  supply_need: "物資需求",
  other: "其他",
};

const NEXT_STATUS: Record<string, { to: AssignmentStatus; label: string }[]> = {
  assigned: [
    { to: "in_progress", label: "開始" },
    { to: "cancelled", label: "取消" },
  ],
  in_progress: [
    { to: "done", label: "完成" },
    { to: "cancelled", label: "取消" },
  ],
  done: [],
  cancelled: [],
};

export default function MatchPanel({ incidentId }: { incidentId: string }) {
  const [matches, setMatches] = useState<MatchesResponse | null>(null);
  const [offers, setOffers] = useState<ResourceOfferItem[]>([]);
  const [assignments, setAssignments] = useState<AssignmentItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [offerType, setOfferType] = useState<OfferType>("supply");
  const [item, setItem] = useState("");

  const load = useCallback(async () => {
    try {
      const [m, o, a] = await Promise.all([
        api.getMatches(incidentId),
        api.listResources(incidentId, {}),
        api.listAssignments(incidentId),
      ]);
      setMatches(m);
      setOffers(o.items);
      setAssignments(a.items);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [incidentId]);

  useEffect(() => {
    load();
  }, [load]);

  const offerLabel = useMemo(() => {
    const m = new Map<string, string>();
    offers.forEach((o) => m.set(o.id, o.item));
    return m;
  }, [offers]);
  const needLabel = useMemo(() => {
    const m = new Map<string, string>();
    (matches?.items ?? []).forEach((i) =>
      m.set(i.report_id, NEED_LABELS[i.need_type] || i.need_type)
    );
    return m;
  }, [matches]);

  async function addOffer(e: React.FormEvent) {
    e.preventDefault();
    if (!item.trim()) return;
    setBusy(true);
    try {
      await api.submitResource(incidentId, { offer_type: offerType, item: item.trim() });
      setItem("");
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function dispatch(reportId: string, offerId: string) {
    setBusy(true);
    try {
      await api.createAssignment(incidentId, { report_id: reportId, offer_id: offerId });
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function advance(id: string, to: AssignmentStatus) {
    setBusy(true);
    try {
      await api.updateAssignment(id, to);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <form onSubmit={addOffer} className="db-card flex flex-wrap items-end gap-2 p-4">
        <div>
          <label className="db-label">資源類型</label>
          <select
            className="db-input"
            value={offerType}
            onChange={(e) => setOfferType(e.target.value as OfferType)}
          >
            <option value="supply">物資</option>
            <option value="volunteer">志工</option>
          </select>
        </div>
        <div className="flex-1">
          <label className="db-label">品項 / 可協助項目</label>
          <input
            className="db-input"
            placeholder="例如：飲用水 / 清淤"
            value={item}
            onChange={(e) => setItem(e.target.value)}
          />
        </div>
        <button type="submit" disabled={busy} className="db-btn db-btn-primary">
          {busy ? "處理中…" : "登記資源"}
        </button>
      </form>

      {error ? <p className="text-sm text-rose-600">{error}</p> : null}

      {matches ? (
        <div className="db-card p-5">
          <div className="flex items-center justify-between">
            <span className="db-eyebrow">需求-資源媒合</span>
            <span className="text-xs text-stone-500">
              開放資源 {matches.open_offers} · 已配對 {matches.matched_reports} · 待補 {matches.unmatched_reports}
            </span>
          </div>

          {matches.items.length === 0 ? (
            <p className="mt-3 text-sm text-stone-400">尚無開放中的通報需求。</p>
          ) : (
            <ul className="mt-3 space-y-3">
              {matches.items.map((m) => (
                <li key={m.report_id} className="rounded-xl border border-stone-200 p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="db-chip">{NEED_LABELS[m.need_type] || m.need_type}</span>
                    <StatusBadge value={m.triage_priority} prefix="分流" />
                  </div>
                  <p className="mt-1.5 text-sm text-stone-700">{m.description}</p>
                  {m.candidates.length === 0 ? (
                    <p className="mt-2 text-xs text-stone-400">尚無可媒合的資源。</p>
                  ) : (
                    <ul className="mt-2 space-y-1">
                      {m.candidates.map((c) => (
                        <li
                          key={c.offer_id}
                          className="flex items-center justify-between gap-2 rounded-lg bg-stone-50 px-3 py-1.5 text-xs"
                        >
                          <span className="text-stone-700">
                            {c.offer_type === "supply" ? "物資" : "志工"} · {c.item}
                            {c.quantity ? ` ×${c.quantity}` : ""}
                            <span className="ml-2 font-mono text-stone-400">
                              {c.distance_km != null ? `${c.distance_km} km` : "—"}
                            </span>
                          </span>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => dispatch(m.report_id, c.offer_id)}
                            className="shrink-0 rounded-md px-2 py-1 text-[11px] font-medium text-stone-50"
                            style={{ background: "#1b1a17" }}
                          >
                            派工
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}

      {assignments.length > 0 ? (
        <div className="db-card p-5">
          <span className="db-eyebrow">派工追蹤</span>
          <ul className="mt-3 space-y-2">
            {assignments.map((a) => (
              <li
                key={a.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-stone-50 px-3 py-2 text-sm"
              >
                <span className="text-stone-700">
                  {needLabel.get(a.report_id) ?? "需求"} ← {offerLabel.get(a.offer_id) ?? "資源"}
                </span>
                <span className="flex items-center gap-2">
                  <StatusBadge value={a.status} />
                  {(NEXT_STATUS[a.status] ?? []).map((t) => (
                    <button
                      key={t.to}
                      type="button"
                      disabled={busy}
                      onClick={() => advance(a.id, t.to)}
                      className="rounded-md border border-stone-300 px-2 py-0.5 text-[11px] text-stone-600 transition hover:border-stone-400"
                    >
                      {t.label}
                    </button>
                  ))}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
