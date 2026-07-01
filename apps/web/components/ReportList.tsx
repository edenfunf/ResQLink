import type { ReportItem } from "@/lib/types";
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

export default function ReportList({
  reports,
  onVerify,
}: {
  reports: ReportItem[];
  onVerify?: (
    reportId: string,
    status: "verified" | "rejected" | "unverified"
  ) => void;
}) {
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
              <StatusBadge value={r.triage_priority} prefix="分流" />
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
          {onVerify ? (
            <div className="mt-2.5 flex flex-wrap gap-2">
              {r.verification_status !== "verified" ? (
                <button
                  type="button"
                  onClick={() => onVerify(r.id, "verified")}
                  className="rounded-md border border-stone-300 px-2 py-0.5 text-[11px] text-stone-600 transition hover:border-[#6f7a4e] hover:text-[#4f5b3c]"
                >
                  查證屬實
                </button>
              ) : null}
              {r.verification_status !== "rejected" ? (
                <button
                  type="button"
                  onClick={() => onVerify(r.id, "rejected")}
                  className="rounded-md border border-stone-300 px-2 py-0.5 text-[11px] text-stone-600 transition hover:border-[#b9543f] hover:text-[#8c3b2e]"
                >
                  標記不實
                </button>
              ) : null}
              {r.verification_status !== "unverified" ? (
                <button
                  type="button"
                  onClick={() => onVerify(r.id, "unverified")}
                  className="rounded-md border border-stone-300 px-2 py-0.5 text-[11px] text-stone-400 transition hover:border-stone-400"
                >
                  復原
                </button>
              ) : null}
            </div>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
