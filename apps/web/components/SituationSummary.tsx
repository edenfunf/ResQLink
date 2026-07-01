import type { CountByKey, IncidentSummary } from "@/lib/types";

const NEED_LABELS: Record<string, string> = {
  flooding: "淹水",
  mud_removal: "清淤",
  road_blocked: "道路中斷",
  trapped_person: "受困人員",
  medical_need: "醫療需求",
  supply_need: "物資需求",
  other: "其他",
};

const SEV_LABELS: Record<string, string> = {
  critical: "極高",
  high: "高",
  medium: "中",
  low: "低",
};

const SEV_BAR: Record<string, string> = {
  critical: "bg-[#8c3b2e]",
  high: "bg-[#b9543f]",
  medium: "bg-[#c19a47]",
  low: "bg-[#d9d1c3]",
};

const TRIAGE_LABELS: Record<string, string> = {
  critical: "極急",
  high: "急",
  normal: "一般",
  low: "低",
};

const TRIAGE_BAR: Record<string, string> = {
  critical: "bg-[#8c3b2e]",
  high: "bg-[#b9543f]",
  normal: "bg-[#7c828f]",
  low: "bg-[#d9d1c3]",
};

function Metric({
  value,
  label,
  accent,
}: {
  value: number;
  label: string;
  accent?: string;
}) {
  return (
    <div className="rounded-xl bg-stone-50 px-4 py-3">
      <div className={`text-2xl font-semibold tabular-nums ${accent ?? "text-stone-900"}`}>
        {value}
      </div>
      <div className="mt-0.5 text-xs text-stone-500">{label}</div>
    </div>
  );
}

function ReadyChip({ on, label }: { on: boolean; label: string }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs ring-1 ring-inset"
      style={
        on
          ? ({ background: "#e7ebdd", color: "#4f5b3c", "--tw-ring-color": "#d7dec8" } as React.CSSProperties)
          : ({ background: "#f3efe7", color: "#a89e8e", "--tw-ring-color": "#e7e1d7" } as React.CSSProperties)
      }
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: on ? "#6f7a4e" : "#cabfac" }} />
      {label}
    </span>
  );
}

function Breakdown({
  title,
  items,
  labels,
  barClass,
}: {
  title: string;
  items: CountByKey[];
  labels: Record<string, string>;
  barClass?: Record<string, string>;
}) {
  const max = Math.max(1, ...items.map((i) => i.count));
  return (
    <div>
      <p className="text-xs font-medium text-stone-500">{title}</p>
      {items.length === 0 ? (
        <p className="mt-2 text-sm text-stone-400">尚無通報</p>
      ) : (
        <ul className="mt-2 space-y-1.5">
          {items.map((i) => (
            <li key={i.key} className="flex items-center gap-2">
              <span className="w-16 shrink-0 text-xs text-stone-600">
                {labels[i.key] ?? i.key}
              </span>
              <span className="h-2 flex-1 overflow-hidden rounded-full bg-stone-100">
                <span
                  className={`block h-full rounded-full ${barClass?.[i.key] ?? "bg-stone-800"}`}
                  style={{ width: `${(i.count / max) * 100}%` }}
                />
              </span>
              <span className="w-5 shrink-0 text-right text-xs font-medium tabular-nums text-stone-700">
                {i.count}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function SituationSummary({ summary }: { summary: IncidentSummary }) {
  const { artifacts, reviews, reports, readiness } = summary;

  return (
    <section className="db-card p-6">
      <div className="flex items-center justify-between">
        <div>
          <span className="db-eyebrow">Situation Summary</span>
          <h2 className="mt-1 text-lg font-semibold tracking-tight text-stone-900">
            情勢摘要
          </h2>
        </div>
        <div className="flex flex-wrap justify-end gap-1.5">
          <ReadyChip on={readiness.bootstrapped} label="已生成元件" />
          <ReadyChip on={readiness.has_public_content} label="可公開" />
          <ReadyChip on={readiness.has_reports} label="有通報" />
        </div>
      </div>

      {reports.critical_open > 0 ? (
        <div
          className="mt-4 flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium"
          style={{ background: "#f7e3dc", color: "#8c3b2e" }}
        >
          <span className="h-2 w-2 rounded-full" style={{ background: "#8c3b2e" }} />
          有 {reports.critical_open} 筆「極急」通報尚未結案，建議優先處理與媒合。
        </div>
      ) : null}

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Metric value={artifacts.approved} label="已通過元件" accent="text-[#566246]" />
        <Metric value={reviews.pending} label="待審核" accent="text-[#876c2c]" />
        <Metric value={reports.total} label="民眾通報" />
        <Metric value={reports.geolocated} label="可上圖" accent="text-[#8c3b2e]" />
      </div>

      <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        <Breakdown
          title="通報需求類型"
          items={reports.by_need_type}
          labels={NEED_LABELS}
        />
        <Breakdown
          title="通報嚴重程度"
          items={reports.by_severity}
          labels={SEV_LABELS}
          barClass={SEV_BAR}
        />
        <Breakdown
          title="分流優先序"
          items={reports.by_triage_priority}
          labels={TRIAGE_LABELS}
          barClass={TRIAGE_BAR}
        />
      </div>
    </section>
  );
}
