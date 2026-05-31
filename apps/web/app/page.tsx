"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import { api, API_BASE } from "@/lib/api";
import type { HealthResponse } from "@/lib/types";

const PHASES = [
  { tag: "01", name: "事件標準化", text: "接收官方警戒 / 人工建案，轉成標準化 Incident 與事件 outbox。" },
  { tag: "02", name: "元件生成 + 審核", text: "一鍵 Bootstrap 生成 6 種救災元件，並建立人工審核任務。" },
  { tag: "03", name: "通報 + GeoJSON", text: "民眾災情通報落地，輸出去識別化 GeoJSON 與 approved-only 公開頁。" },
  { tag: "04", name: "可操作前端", text: "管理台、審核台、公開入口、通報頁與 Leaflet 地圖。" },
];

function HealthPill({
  health,
  error,
}: {
  health: HealthResponse | null;
  error: string | null;
}) {
  if (health) {
    return (
      <span
        className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm ring-1 ring-inset"
        style={{ background: "#e7ebdd", color: "#4f5b3c", "--tw-ring-color": "#d7dec8" } as React.CSSProperties}
      >
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60" style={{ background: "#6f7a4e" }} />
          <span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: "#6f7a4e" }} />
        </span>
        API 正常 · {health.service} v{health.version}
      </span>
    );
  }
  if (error) {
    return (
      <span
        className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm ring-1 ring-inset"
        style={{ background: "#efddd3", color: "#8a4a3a", "--tw-ring-color": "#e4cabb" } as React.CSSProperties}
      >
        <span className="h-2 w-2 rounded-full" style={{ background: "#a85d49" }} />
        API 無法連線
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-2 rounded-full bg-stone-100 px-3 py-1 text-sm text-stone-500 ring-1 ring-inset ring-stone-200">
      <span className="h-2 w-2 animate-pulse rounded-full bg-stone-400" />
      檢查 API 狀態中…
    </span>
  );
}

export default function HomePage() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [healthError, setHealthError] = useState<string | null>(null);

  useEffect(() => {
    api
      .health()
      .then(setHealth)
      .catch((e) => setHealthError((e as Error).message));
  }, []);

  return (
    <AppShell>
      <section className="db-card relative overflow-hidden px-7 py-12 sm:px-12 sm:py-16">
        <div
          className="pointer-events-none absolute right-0 top-0 h-full w-1/2 opacity-[0.5]"
          style={{
            backgroundImage:
              "repeating-linear-gradient(135deg, rgba(140,59,46,.05) 0 1px, transparent 1px 22px)",
            maskImage: "linear-gradient(to left, black, transparent 80%)",
          }}
        />
        <div className="relative max-w-2xl">
          <span className="db-eyebrow">防災積木元件 · Disaster Response Toolkit</span>
          <h1 className="font-display mt-4 text-5xl font-semibold leading-[1.05] text-stone-900 sm:text-6xl">
            DisasterBlock
          </h1>
          <div className="mt-5 h-px w-16" style={{ background: "#8c3b2e" }} />
          <p className="font-display mt-5 text-xl text-stone-700">
            堰塞湖災害通報與救災入口生成元件
          </p>
          <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-stone-500">
            把一次災害事件，自動變成救災入口、表單、地圖與民眾通報通道，並以標準格式輸出，
            讓任何防災系統都能拼接使用。
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link href="/console" className="db-btn db-btn-accent">
              進入管理台
            </Link>
            <Link href="/console/new" className="db-btn db-btn-ghost">
              建立事件
            </Link>
            <a
              href={`${API_BASE}/docs`}
              target="_blank"
              rel="noreferrer"
              className="db-btn text-stone-500 hover:text-stone-900"
            >
              API 文件 ↗
            </a>
          </div>

          <div className="mt-8">
            <HealthPill health={health} error={healthError} />
          </div>
        </div>
      </section>

      <section className="mt-12">
        <div className="flex items-end justify-between">
          <div>
            <span className="db-eyebrow">Pipeline</span>
            <h2 className="font-display db-section-title mt-1.5 text-xl">
              從事件到公開的資料流
            </h2>
          </div>
          <Link
            href="/console/new"
            className="hidden text-sm font-medium sm:block"
            style={{ color: "#8c3b2e" }}
          >
            立即建立事件 →
          </Link>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PHASES.map((p) => (
            <div key={p.tag} className="db-card db-card-hover p-5">
              <div className="flex items-center gap-2.5">
                <span
                  className="font-display grid h-8 w-8 place-items-center rounded-md text-sm font-semibold"
                  style={{ background: "#efeae0", color: "#8c3b2e" }}
                >
                  {p.tag}
                </span>
                <h3 className="text-sm font-semibold text-stone-900">{p.name}</h3>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-stone-500">{p.text}</p>
            </div>
          ))}
        </div>
      </section>
    </AppShell>
  );
}
