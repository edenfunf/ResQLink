/** A KPI stat card for dashboards. */
export default function Stat({
  value,
  label,
  hint,
  accent,
  alert = false,
  delay = 0,
}: {
  value: number | string;
  label: string;
  hint?: string;
  accent?: string;
  alert?: boolean;
  delay?: number;
}) {
  return (
    <div
      className="db-stat db-reveal"
      style={{
        animationDelay: `${delay}ms`,
        ...(alert
          ? { borderColor: "#e4b6ab", background: "linear-gradient(135deg,#fbf1ec,#f9e8e1)" }
          : {}),
      }}
    >
      <div
        className="font-display text-3xl font-semibold tabular-nums"
        style={{ color: accent ?? (alert ? "#8c3b2e" : "#1b1a17") }}
      >
        {value}
      </div>
      <div className="mt-1 text-xs font-medium text-stone-500">{label}</div>
      {hint ? <div className="mt-0.5 text-[11px] text-stone-400">{hint}</div> : null}
    </div>
  );
}
