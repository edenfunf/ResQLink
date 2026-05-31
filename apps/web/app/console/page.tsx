"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import IncidentCard from "@/components/IncidentCard";
import { api } from "@/lib/api";
import type { IncidentListItem } from "@/lib/types";

export default function ConsolePage() {
  const [incidents, setIncidents] = useState<IncidentListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    api
      .listIncidents({ limit: 50 })
      .then((res) => setIncidents(res.items))
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
          <span className="db-eyebrow">Console</span>
          <h1 className="font-display mt-1 text-2xl font-semibold tracking-tight text-stone-900">
            管理台
          </h1>
          <p className="mt-1 text-sm text-stone-500">
            災害事件列表
            {!loading && !error ? `（共 ${incidents.length} 筆）` : ""}
          </p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={load} className="db-btn db-btn-ghost">
            重新整理
          </button>
          <Link href="/console/new" className="db-btn db-btn-primary">
            建立新事件
          </Link>
        </div>
      </div>

      {error ? (
        <p className="mt-6 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700 ring-1 ring-inset ring-rose-100">
          {error}
        </p>
      ) : loading ? (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="db-card h-40 animate-pulse bg-stone-100/60" />
          ))}
        </div>
      ) : incidents.length === 0 ? (
        <div className="db-card mt-6 grid place-items-center p-12 text-center">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-stone-100 text-stone-400">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M12 5v14M5 12h14" strokeLinecap="round" />
            </svg>
          </div>
          <p className="mt-4 text-stone-600">目前沒有任何事件。</p>
          <Link href="/console/new" className="db-btn db-btn-primary mt-4">
            建立第一個事件
          </Link>
        </div>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {incidents.map((i) => (
            <IncidentCard key={i.id} incident={i} />
          ))}
        </div>
      )}
    </AppShell>
  );
}
