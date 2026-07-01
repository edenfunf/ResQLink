"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { TimelineItem } from "@/lib/types";

function fmt(s: string): string {
  try {
    return new Date(s).toLocaleString("zh-TW", {
      hour12: false,
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return s;
  }
}

const DOT: Record<string, string> = {
  "incident.created": "#1b1a17",
  "incident.bootstrapped": "#876c2c",
  "artifact.approved": "#6f7a4e",
  "artifact.rejected": "#a85d49",
  "disaster_report.created": "#8c3b2e",
  "agent.planned": "#7c828f",
  "agent.executed": "#b9543f",
  "resource_offer.created": "#566246",
};

export default function Timeline({ incidentId }: { incidentId: string }) {
  const [items, setItems] = useState<TimelineItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .getTimeline(incidentId)
      .then((r) => setItems(r.items))
      .catch((e) => setError((e as Error).message));
  }, [incidentId]);

  if (error) return <p className="text-sm text-rose-600">{error}</p>;
  if (!items) return <p className="text-sm text-stone-400">載入中…</p>;
  if (items.length === 0)
    return <p className="text-sm text-stone-400">尚無事件記錄。</p>;

  return (
    <ol className="relative ml-2 space-y-4 border-l border-stone-200 pl-5">
      {items.map((it, i) => (
        <li key={i} className="relative">
          <span
            className="absolute -left-[1.45rem] top-1 h-2.5 w-2.5 rounded-full ring-2 ring-white"
            style={{ background: DOT[it.event_type] ?? "#b3a994" }}
          />
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="font-medium text-stone-900">{it.label}</span>
            <span className="font-mono text-[11px] text-stone-400">{fmt(it.at)}</span>
          </div>
          <p className="mt-0.5 text-sm text-stone-600">{it.summary}</p>
        </li>
      ))}
    </ol>
  );
}
