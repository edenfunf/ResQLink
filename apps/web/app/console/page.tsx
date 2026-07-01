"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import IncidentCard from "@/components/IncidentCard";
import Stat from "@/components/Stat";
import Reveal from "@/components/Reveal";
import Skeleton from "@/components/Skeleton";
import { api } from "@/lib/api";
import type { IncidentListItem, OverviewResponse } from "@/lib/types";

export default function ConsolePage() {
  const [incidents, setIncidents] = useState<IncidentListItem[]>([]);
  const [overview, setOverview] = useState<OverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    Promise.all([api.listIncidents({ limit: 50 }), api.getOverview()])
      .then(([list, ov]) => {
        setIncidents(list.items);
        setOverview(ov);
      })
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <AppShell>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <span className="db-eyebrow">Command Console</span>
          <h1 className="font-display mt-1 text-2xl font-semibold tracking-tight text-stone-900">
            指揮中心
          </h1>
          <p className="mt-1 text-sm text-stone-500">跨事件即時態勢與救災作業總覽</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={load} className="db-btn db-btn-ghost">
            重新整理
          </button>
          <Link href="/console/agent" className="db-btn db-btn-accent">
            AI 編排
          </Link>
          <Link href="/console/new" className="db-btn db-btn-primary">
            建立事件
          </Link>
        </div>
      </div>

      {error ? (
        <p className="mt-6 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700 ring-1 ring-inset ring-rose-100">
          {error}
        </p>
      ) : null}

      {/* critical alert */}
      {overview && overview.reports_critical_open > 0 ? (
        <Reveal className="mt-6">
          <div
            className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium"
            style={{ background: "#f7e3dc", color: "#8c3b2e" }}
          >
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60" style={{ background: "#8c3b2e" }} />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full" style={{ background: "#8c3b2e" }} />
            </span>
            全系統有 {overview.reports_critical_open} 筆「極急」通報尚未結案，請優先處置與媒合。
          </div>
        </Reveal>
      ) : null}

      {/* KPI row */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {loading || !overview ? (
          Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-[88px]" />
          ))
        ) : (
          <>
            <Stat value={overview.incidents_open} label="進行中事件" hint={`共 ${overview.incidents_total} 筆`} delay={0} />
            <Stat value={overview.reviews_pending} label="待審核" accent="#876c2c" delay={50} />
            <Stat value={overview.reports_critical_open} label="極急未結" alert={overview.reports_critical_open > 0} delay={100} />
            <Stat value={overview.reports_total} label="民眾通報" hint={`未查證 ${overview.reports_unverified}`} delay={150} />
            <Stat value={overview.resources_open} label="開放資源" accent="#4f5b3c" delay={200} />
            <Stat value={overview.assignments_active} label="派工進行中" hint={`已發布 ${overview.publications_total}`} delay={250} />
          </>
        )}
      </div>

      <div className="mt-8 flex items-baseline gap-2">
        <h2 className="db-section-title">災害事件</h2>
        <span className="text-sm text-stone-400">
          Incidents{!loading && !error ? ` · ${incidents.length}` : ""}
        </span>
      </div>

      {loading ? (
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
      ) : incidents.length === 0 ? (
        <div className="db-card mt-4 grid place-items-center p-12 text-center">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-stone-100 text-stone-400">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M12 5v14M5 12h14" strokeLinecap="round" />
            </svg>
          </div>
          <p className="mt-4 text-stone-600">目前沒有任何事件。</p>
          <div className="mt-4 flex gap-2">
            <Link href="/console/agent" className="db-btn db-btn-accent">
              用 AI 編排建立
            </Link>
            <Link href="/console/new" className="db-btn db-btn-ghost">
              手動建立
            </Link>
          </div>
        </div>
      ) : (
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {incidents.map((i, idx) => (
            <Reveal key={i.id} delay={Math.min(idx * 40, 320)}>
              <IncidentCard incident={i} />
            </Reveal>
          ))}
        </div>
      )}
    </AppShell>
  );
}
