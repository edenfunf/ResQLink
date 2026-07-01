"use client";

import { useEffect, useMemo, useState } from "react";
import AppShell from "@/components/AppShell";
import { api } from "@/lib/api";
import type { ModuleSpecItem } from "@/lib/types";

const TYPE_LABEL: Record<string, string> = {
  generator: "生成型",
  processor: "處理型",
  action: "動作型",
};

const TYPE_STYLE: Record<string, { bg: string; text: string }> = {
  generator: { bg: "#e7ebdd", text: "#4f5b3c" },
  processor: { bg: "#e5e6ea", text: "#565a66" },
  action: { bg: "#efddd3", text: "#8a4a3a" },
};

export default function ModuleCatalogPage() {
  const [modules, setModules] = useState<ModuleSpecItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .listModules()
      .then((r) => setModules(r.items))
      .catch((e) => setError((e as Error).message));
  }, []);

  const grouped = useMemo(() => {
    const g = new Map<string, { label: string; items: ModuleSpecItem[] }>();
    (modules ?? []).forEach((m) => {
      if (!g.has(m.category)) g.set(m.category, { label: m.category_label, items: [] });
      g.get(m.category)!.items.push(m);
    });
    return Array.from(g.values());
  }, [modules]);

  const stats = useMemo(() => {
    const all = modules ?? [];
    return {
      total: all.length,
      implemented: all.filter((m) => m.implemented).length,
      generators: all.filter((m) => m.module_type === "generator").length,
    };
  }, [modules]);

  return (
    <AppShell>
      <span className="db-eyebrow block">Module Catalogue</span>
      <h1 className="font-display mt-1 text-2xl font-semibold tracking-tight text-stone-900">
        防災積木模組目錄
      </h1>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-stone-500">
        系統的能力地圖：依十個救災大方向分類。生成型模組可由 bootstrap / AI 編排直接產出可審核元件；
        處理型與動作型為服務端點或路線圖。
      </p>

      {modules ? (
        <p className="mt-3 text-sm text-stone-500">
          共 {stats.total} 個模組 · {stats.implemented} 個已實作 · {stats.generators} 個生成型
        </p>
      ) : null}

      {error ? (
        <p className="mt-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>
      ) : null}

      <div className="mt-6 space-y-8">
        {grouped.map((group) => (
          <section key={group.label}>
            <h2 className="db-section-title">{group.label}</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {group.items.map((m) => {
                const ts = TYPE_STYLE[m.module_type] ?? TYPE_STYLE.processor;
                return (
                  <div key={m.id} className="db-card flex flex-col p-4">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-semibold text-stone-900">{m.name}</h3>
                      <span
                        className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold"
                        style={{ background: ts.bg, color: ts.text }}
                      >
                        {TYPE_LABEL[m.module_type] ?? m.module_type}
                      </span>
                    </div>
                    <p className="mt-1 font-mono text-[10px] text-stone-400">{m.id}</p>
                    <p className="mt-2 flex-1 text-xs leading-relaxed text-stone-600">
                      {m.description}
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-1.5">
                      {m.default_enabled ? (
                        <span className="rounded bg-[#efddd3] px-1.5 py-0.5 text-[10px] font-semibold text-[#8c3b2e]">
                          核心預設
                        </span>
                      ) : null}
                      <span
                        className="rounded px-1.5 py-0.5 text-[10px] font-medium"
                        style={
                          m.implemented
                            ? { background: "#e7ebdd", color: "#4f5b3c" }
                            : { background: "#f3efe7", color: "#a89e8e" }
                        }
                      >
                        {m.implemented ? "已實作" : "規劃中"}
                      </span>
                    </div>
                    {m.endpoint ? (
                      <p className="mt-2 font-mono text-[10px] leading-relaxed text-stone-400">
                        {m.endpoint}
                      </p>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </AppShell>
  );
}
