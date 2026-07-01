"use client";

import Link from "next/link";
import type { IncidentSummary } from "@/lib/types";

const STEPS = ["建立", "生成", "審核", "公開"];

export default function DemoGuide({
  summary,
  slug,
  incidentId,
  onBootstrap,
  bootBusy,
}: {
  summary: IncidentSummary;
  slug: string;
  incidentId: string;
  onBootstrap: (useAi?: boolean) => void;
  bootBusy: boolean;
}) {
  const bootstrapped = summary.readiness.bootstrapped;
  const hasApproved = summary.artifacts.approved > 0;
  const hasReports = summary.readiness.has_reports;

  const active = !bootstrapped ? 1 : !hasApproved ? 2 : 3;
  const complete = hasApproved && hasReports;

  let message: React.ReactNode;
  let action: React.ReactNode = null;

  if (!bootstrapped) {
    message = "尚未生成救災元件。可用規則式或 AI 並行草擬，兩者皆須人工審核才公開。";
    action = (
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onBootstrap(false)}
          disabled={bootBusy}
          className="db-btn db-btn-ghost"
        >
          {bootBusy ? "生成中…" : "規則式生成"}
        </button>
        <button
          type="button"
          onClick={() => onBootstrap(true)}
          disabled={bootBusy}
          className="db-btn db-btn-accent"
        >
          以 AI 生成（beta）
        </button>
      </div>
    );
  } else if (!hasApproved) {
    message =
      `已生成 ${summary.artifacts.total} 個元件，待審核；通過審核的元件才會於公開頁顯示。`;
  } else if (!hasReports) {
    message = "已有審核通過的可公開元件。";
    action = (
      <div className="flex gap-2">
        <Link href={`/preview/${encodeURIComponent(slug)}`} className="db-btn db-btn-ghost">
          公開 Preview
        </Link>
        <Link href={`/reports/${incidentId}`} className="db-btn db-btn-ghost">
          通報頁
        </Link>
      </div>
    );
  } else {
    message =
      "流程完整：公開頁僅顯示審核通過內容，地圖呈現民眾通報，對外輸出去識別化。";
    action = (
      <Link href={`/preview/${encodeURIComponent(slug)}`} className="db-btn db-btn-ghost">
        公開 Preview
      </Link>
    );
  }

  return (
    <section
      className="db-card px-5 py-3.5"
      style={complete ? { borderColor: "#d2d9c6" } : undefined}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="db-eyebrow">Workflow</span>
        <ol className="flex items-center gap-1.5 text-xs">
          {STEPS.map((label, i) => {
            const done = i < active || (complete && i <= active);
            const isActive = i === active && !complete;
            return (
              <li key={label} className="flex items-center gap-1.5">
                <span
                  className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 ring-1 ring-inset"
                  style={
                    isActive
                      ? ({ background: "#8c3b2e", color: "#f4f1ec", "--tw-ring-color": "#73291f" } as React.CSSProperties)
                      : done
                        ? ({ background: "#e7ebdd", color: "#4f5b3c", "--tw-ring-color": "#d7dec8" } as React.CSSProperties)
                        : ({ background: "#f3efe7", color: "#a89e8e", "--tw-ring-color": "#e7e1d7" } as React.CSSProperties)
                  }
                >
                  <span className="font-semibold">{done ? "✓" : i + 1}</span>
                  <span className="hidden sm:inline">{label}</span>
                </span>
                {i < STEPS.length - 1 ? <span className="text-stone-300">→</span> : null}
              </li>
            );
          })}
        </ol>
      </div>

      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm leading-relaxed text-stone-600">{message}</p>
        {action}
      </div>
    </section>
  );
}
