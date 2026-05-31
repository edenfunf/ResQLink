type Style = { bg: string; text: string; ring: string; dot: string; bold?: boolean };

const NEUTRAL: Style = { bg: "#efeae0", text: "#6b6457", ring: "#e3dccf", dot: "#b3a994" };
const OCHRE: Style = { bg: "#f1e7d0", text: "#876c2c", ring: "#e6d6b2", dot: "#b8923f" };
const MOSS: Style = { bg: "#e7ebdd", text: "#4f5b3c", ring: "#d7dec8", dot: "#6f7a4e" };
const CLAY: Style = { bg: "#efddd3", text: "#8a4a3a", ring: "#e4cabb", dot: "#a85d49" };
const STEEL: Style = { bg: "#e5e6ea", text: "#565a66", ring: "#d8dade", dot: "#7c828f" };
const TERRA: Style = { bg: "#efd9cf", text: "#8c3b2e", ring: "#e4c2b3", dot: "#b9543f", bold: true };
const OXBLOOD: Style = { bg: "#8c3b2e", text: "#f4f1ec", ring: "#73291f", dot: "#f4f1ec", bold: true };

const STYLES: Record<string, Style> = {
  // incident
  draft: NEUTRAL,
  active: MOSS,
  archived: NEUTRAL,
  // artifact / review
  pending_review: OCHRE,
  pending: OCHRE,
  approved: MOSS,
  rejected: CLAY,
  // report status
  new: STEEL,
  triaged: OCHRE,
  in_progress: STEEL,
  resolved: MOSS,
  // verification
  unverified: NEUTRAL,
  verified: MOSS,
  // severity / risk
  low: NEUTRAL,
  medium: OCHRE,
  high: TERRA,
  critical: OXBLOOD,
};

const LABELS: Record<string, string> = {
  draft: "草稿",
  active: "啟用",
  archived: "封存",
  pending_review: "待審核",
  pending: "待審核",
  approved: "已通過",
  rejected: "已退回",
  new: "新進",
  triaged: "已分流",
  in_progress: "處理中",
  resolved: "已解決",
  unverified: "未驗證",
  verified: "已驗證",
  low: "低",
  medium: "中",
  high: "高",
  critical: "極高",
};

export default function StatusBadge({
  value,
  prefix,
}: {
  value: string;
  prefix?: string;
}) {
  const s = STYLES[value] ?? NEUTRAL;
  const label = LABELS[value] ?? value;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs ring-1 ring-inset ${
        s.bold ? "font-semibold" : "font-medium"
      }`}
      style={{ backgroundColor: s.bg, color: s.text, "--tw-ring-color": s.ring } as React.CSSProperties}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: s.dot }} />
      {prefix ? <span className="font-normal opacity-70">{prefix}</span> : null}
      {label}
    </span>
  );
}
