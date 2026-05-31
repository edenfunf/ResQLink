import type { ReportItem } from "@/lib/types";
import StatusBadge from "./StatusBadge";

const NEED_LABELS: Record<string, string> = {
  flooding: "淹水",
  mud_removal: "清淤",
  road_blocked: "道路中斷",
  trapped_person: "受困人員",
  medical_need: "醫療需求",
  supply_need: "物資需求",
  other: "其他",
};

function fmtDate(s: string): string {
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

export default function ReportList({ reports }: { reports: ReportItem[] }) {
  if (reports.length === 0) {
    return (
      <div className="db-card grid place-items-center p-8 text-center">
        <p className="text-sm text-stone-500">目前尚無民眾通報。</p>
      </div>
    );
  }

  return (
    <ul className="space-y-2.5">
      {reports.map((r) => (
        <li key={r.id} className="db-card p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="db-chip">{NEED_LABELS[r.need_type] || r.need_type}</span>
              <StatusBadge value={r.severity} prefix="嚴重度" />
              <StatusBadge value={r.status} />
              <StatusBadge value={r.verification_status} />
            </div>
            <span className="shrink-0 text-xs text-stone-400">
              {fmtDate(r.created_at)}
            </span>
          </div>
          <p className="mt-2.5 text-sm leading-relaxed text-stone-800">{r.description}</p>
          {r.address ? (
            <p className="mt-1.5 text-xs text-stone-500">
              <span className="text-stone-400">地點 ·</span> {r.address}
            </p>
          ) : null}
          {r.reporter_name ? (
            <p className="mt-0.5 text-xs text-stone-400">通報者 · {r.reporter_name}</p>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
