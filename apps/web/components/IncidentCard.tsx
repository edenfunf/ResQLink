import Link from "next/link";
import type { IncidentListItem } from "@/lib/types";
import StatusBadge from "./StatusBadge";

function fmtDate(s: string): string {
  try {
    return new Date(s).toLocaleString("zh-TW", {
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return s;
  }
}

const ACCENT: Record<string, string> = {
  low: "bg-[#d9d1c3]",
  medium: "bg-[#c19a47]",
  high: "bg-[#b9543f]",
  critical: "bg-[#8c3b2e]",
};

export default function IncidentCard({ incident }: { incident: IncidentListItem }) {
  const place = [incident.county, incident.town, incident.river]
    .filter(Boolean)
    .join(" · ");

  return (
    <Link
      href={`/incidents/${incident.id}`}
      className="db-card db-card-hover group relative block overflow-hidden p-5 pl-6"
    >
      <span
        className={`absolute inset-y-0 left-0 w-1.5 ${ACCENT[incident.severity] ?? "bg-stone-300"}`}
      />
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-[15px] font-semibold leading-snug text-stone-900">
          {incident.title}
        </h3>
        <StatusBadge value={incident.severity} prefix="嚴重度" />
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        <span className="db-chip">{incident.scenario_type}</span>
        <StatusBadge value={incident.status} />
      </div>

      {place ? <p className="mt-3 text-sm text-stone-600">{place}</p> : null}

      <div className="mt-4 flex items-center justify-between border-t border-stone-100 pt-3">
        <span className="text-xs text-stone-400">{fmtDate(incident.created_at)}</span>
        <span className="text-sm font-medium text-stone-500 transition group-hover:text-[#8c3b2e]">
          查看詳細 →
        </span>
      </div>
    </Link>
  );
}
