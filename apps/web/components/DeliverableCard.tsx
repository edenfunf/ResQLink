"use client";

import Link from "next/link";
import type { DeliverableItem, DeliverableStatus } from "@/lib/types";

/* ── outcome icons (stroked, neutral — no template / clip-art feel) ── */
function Icon({ name, color }: { name: string; color: string }) {
  const common = {
    width: 22,
    height: 22,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: color,
    strokeWidth: 1.7,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  switch (name) {
    case "globe":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M3 12h18M12 3c2.5 2.6 2.5 15.4 0 18M12 3c-2.5 2.6-2.5 15.4 0 18" />
        </svg>
      );
    case "facebook":
      return (
        <svg {...common}>
          <path d="M14 8.5h2.2M13 21V8.8c0-1.6 1-2.8 2.8-2.8H17" />
          <path d="M10 12.5h5" />
          <rect x="3" y="3" width="18" height="18" rx="3" />
        </svg>
      );
    case "line":
      return (
        <svg {...common}>
          <path d="M21 10.5c0-3.9-3.9-7-9-7s-9 3.1-9 7c0 3.5 3.2 6.4 7.5 6.9.9.2.8.6.7 1.3l-.2 1.2c-.1.6.3.9.9.6 1-.5 5.4-3.2 7.4-5.6A6.3 6.3 0 0 0 21 10.5Z" />
          <path d="M7.5 9v3.2M7.5 9.2h0M10 12.2V9l2.3 3.2V9M15 9h-1.8v3.2H15M13.2 10.6h1.4M18 9h0v3.2" />
        </svg>
      );
    case "box":
      return (
        <svg {...common}>
          <path d="M21 8 12 3 3 8l9 5 9-5Z" />
          <path d="M3 8v8l9 5 9-5V8M12 13v8" />
        </svg>
      );
    case "users":
      return (
        <svg {...common}>
          <circle cx="9" cy="8" r="3" />
          <path d="M3.5 20a5.5 5.5 0 0 1 11 0M16 6.2a3 3 0 0 1 0 5.6M20.5 20a5.5 5.5 0 0 0-4-5.3" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <rect x="3" y="3" width="18" height="18" rx="3" />
        </svg>
      );
  }
}

const STATUS_META: Record<
  DeliverableStatus,
  { label: string; dot: string; fg: string; bg: string }
> = {
  empty: { label: "尚未建置", dot: "#b8ad9c", fg: "#7c7264", bg: "#f1ece3" },
  draft: { label: "草稿", dot: "#b08948", fg: "#8a6726", bg: "#f6edda" },
  in_review: { label: "待審核", dot: "#3f6cae", fg: "#2f5290", bg: "#e7eef9" },
  ready: { label: "已就緒", dot: "#5f7a4e", fg: "#4a6139", bg: "#e8efdd" },
};

function hexA(hex: string, alpha: number) {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export default function DeliverableCard({
  item,
  delayMs = 0,
}: {
  item: DeliverableItem;
  delayMs?: number;
}) {
  const s = STATUS_META[item.status];
  const built = item.status !== "empty";
  const pct =
    item.member_total > 0
      ? Math.round((item.generated_count / item.member_total) * 100)
      : 0;
  const approvedPct =
    item.member_total > 0
      ? Math.round((item.approved_count / item.member_total) * 100)
      : 0;

  const statusLabel =
    item.status === "in_review"
      ? `待審核 ${item.pending_count}`
      : s.label;

  return (
    <div
      className="db-reveal group relative flex flex-col overflow-hidden rounded-2xl border bg-[var(--card)] p-5 transition duration-200 ease-out hover:-translate-y-0.5"
      style={{
        borderColor: built ? hexA(item.accent, 0.28) : "var(--line)",
        boxShadow: built
          ? `0 1px 0 ${hexA(item.accent, 0.04)}`
          : undefined,
        animationDelay: `${delayMs}ms`,
      }}
    >
      {/* accent spine */}
      <span
        className="pointer-events-none absolute inset-x-0 top-0 h-[3px]"
        style={{
          background: built
            ? `linear-gradient(90deg, ${item.accent}, ${hexA(item.accent, 0.25)})`
            : "transparent",
        }}
      />

      <div className="flex items-start gap-3.5">
        <span
          className="grid h-11 w-11 shrink-0 place-items-center rounded-xl"
          style={{ background: hexA(item.accent, 0.1) }}
        >
          <Icon name={item.icon} color={item.accent} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-display text-[17px] font-semibold leading-tight text-stone-900">
              {item.name}
            </h3>
            <span
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium"
              style={{ background: s.bg, color: s.fg }}
            >
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: s.dot }} />
              {statusLabel}
            </span>
          </div>
          <p className="mt-1 text-[13px] leading-relaxed text-stone-500">
            {item.tagline}
          </p>
        </div>
      </div>

      {/* progress */}
      <div className="mt-4">
        <div className="flex items-center justify-between text-[11px] text-stone-400">
          <span>
            模組 {item.generated_count}/{item.member_total}
          </span>
          <span>已審核 {item.approved_count}</span>
        </div>
        <div className="relative mt-1.5 h-1.5 overflow-hidden rounded-full bg-stone-200/70">
          <span
            className="db-bargrow absolute inset-y-0 left-0 rounded-full"
            style={{ width: `${pct}%`, background: hexA(item.accent, 0.3) }}
          />
          <span
            className="db-bargrow absolute inset-y-0 left-0 rounded-full"
            style={{ width: `${approvedPct}%`, background: item.accent }}
          />
        </div>
      </div>

      {/* actions */}
      <div className="mt-4 flex items-center gap-2 pt-1">
        {built ? (
          <Link
            href={item.front.url}
            className="db-btn flex-1 text-white"
            style={{ background: item.accent }}
          >
            {item.front.label}
            <span aria-hidden>→</span>
          </Link>
        ) : (
          <span className="db-btn flex-1 cursor-not-allowed bg-stone-100 text-stone-400">
            尚未建置
          </span>
        )}
        <Link
          href={item.admin.url}
          className="db-btn db-btn-ghost shrink-0"
          title={item.admin.label}
        >
          {item.admin.label}
        </Link>
      </div>

      {item.front.kind === "external_pending" && built ? (
        <p className="mt-2 text-[11px] leading-snug text-stone-400">
          前台為系統內預覽；正式上線時可綁定真實{item.icon === "facebook" ? " Facebook 粉專" : item.icon === "line" ? " LINE 官方帳號" : "平台"}。
        </p>
      ) : null}
    </div>
  );
}
