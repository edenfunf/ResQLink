"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import { api, API_BASE } from "@/lib/api";
import type { HealthResponse } from "@/lib/types";

const PHASES = [
  { tag: "01", name: "理解 + 標準化", text: "對話式 Agent 聽懂災情描述（多災種），標準化為 Incident 並寫入事件 outbox。" },
  { tag: "02", name: "提案 + 生成", text: "從 27 個模組目錄提案救災元件，由人確認後平行生成；可規則式或 AI 草擬。" },
  { tag: "03", name: "審核 + 公開", text: "每個元件須人工審核才公開；審核通過內容可一鍵發布至 FB / LINE。" },
  { tag: "04", name: "通報 + 分流", text: "民眾通報落地並自動 triage 分流，輸出去識別化 GeoJSON。" },
  { tag: "05", name: "媒合 + 派工", text: "登記志工 / 物資，與需求依距離媒合並派工追蹤至完成。" },
  { tag: "06", name: "態勢 + 稽核", text: "情勢摘要、需求熱點與事件時間軸，全程可稽核。" },
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
            災鏈 ResQLink
          </h1>
          <div className="mt-5 h-px w-16" style={{ background: "#8c3b2e" }} />
          <p className="font-display mt-5 text-xl text-stone-700">
            堰塞湖災害通報與救災入口生成元件
          </p>
          <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-stone-500">
            說一句「發生大地震」，Agent 就從可重複使用的模組目錄，平行拼出救災入口、表單、地圖與通報通道；
            通報自動分流、需求與資源媒合派工，全部以標準格式輸出，且一律經人工審核才公開。
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link href="/console/agent" className="db-btn db-btn-accent">
              對話式 AI 編排
            </Link>
            <Link href="/console" className="db-btn db-btn-ghost">
              進入管理台
            </Link>
            <Link href="/console/modules" className="db-btn db-btn-ghost">
              模組目錄
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
