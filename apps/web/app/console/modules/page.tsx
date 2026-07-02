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

const SCENARIO_LABEL: Record<string, string> = {
  barrier_lake: "堰塞湖",
  earthquake: "地震",
  typhoon: "颱風",
  flood: "水災",
};

type StatusFilter = "all" | "implemented" | "planned";
type TypeFilter = "all" | "generator" | "processor" | "action";

export default function ModuleCatalogPage() {
  const [modules, setModules] = useState<ModuleSpecItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string>("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [type, setType] = useState<TypeFilter>("all");

  useEffect(() => {
    api
      .listModules()
      .then((r) => setModules(r.items))
      .catch((e) => setError((e as Error).message));
  }, []);

  const all = modules ?? [];

  // category chips with counts, in registry order
  const categories = useMemo(() => {
    const g = new Map<string, { label: string; count: number }>();
    all.forEach((m) => {
      const cur = g.get(m.category);
      if (cur) cur.count += 1;
      else g.set(m.category, { label: m.category_label, count: 1 });
    });
    return Array.from(g.entries()).map(([key, v]) => ({ key, ...v }));
  }, [all]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return all.filter((m) => {
      if (cat !== "all" && m.category !== cat) return false;
      if (status === "implemented" && !m.implemented) return false;
      if (status === "planned" && m.implemented) return false;
      if (type !== "all" && m.module_type !== type) return false;
      if (needle) {
        const hay = `${m.name} ${m.id} ${m.description}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [all, q, cat, status, type]);

  const grouped = useMemo(() => {
    const g = new Map<string, { label: string; items: ModuleSpecItem[] }>();
    filtered.forEach((m) => {
      if (!g.has(m.category)) g.set(m.category, { label: m.category_label, items: [] });
      g.get(m.category)!.items.push(m);
    });
    return Array.from(g.values());
  }, [filtered]);

  const stats = useMemo(
    () => ({
      total: all.length,
      implemented: all.filter((m) => m.implemented).length,
      planned: all.filter((m) => !m.implemented).length,
      generators: all.filter((m) => m.module_type === "generator").length,
      processors: all.filter((m) => m.module_type === "processor").length,
      actions: all.filter((m) => m.module_type === "action").length,
    }),
    [all]
  );

  return (
    <AppShell>
      <span className="db-eyebrow block">Module Catalogue</span>
      <h1 className="font-display mt-1 text-2xl font-semibold tracking-tight text-stone-900">
        防災積木模組目錄
      </h1>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-stone-500">
        系統的能力地圖：依十個救災大方向分類。「已實作」模組可由 bootstrap／AI 編排直接產出可審核元件或已有服務端點；
        「規劃中」為已定義規格、待實作的積木，目錄即路線圖。
      </p>

      {/* stats band */}
      {modules ? (
        <div className="db-card mt-4 grid grid-cols-3 divide-x sm:grid-cols-6" style={{ borderColor: "var(--line)" }}>
          <Stat n={stats.total} label="模組總數" />
          <Stat n={stats.implemented} label="已實作" color="#4f5b3c" />
          <Stat n={stats.planned} label="規劃中" color="#a89e8e" />
          <Stat n={stats.generators} label="生成型" />
          <Stat n={stats.processors} label="處理型" />
          <Stat n={stats.actions} label="動作型" />
        </div>
      ) : null}

      {error ? (
        <p className="mt-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>
      ) : null}

      {/* filters */}
      <div className="mt-5 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="搜尋模組名稱、ID 或描述…"
            className="db-input !mt-0 max-w-xs"
          />
          <div className="inline-flex rounded-lg border border-stone-200 bg-white p-0.5 text-xs">
            {(
              [["all", "全部"], ["implemented", "已實作"], ["planned", "規劃中"]] as const
            ).map(([v, label]) => (
              <FilterBtn key={v} active={status === v} onClick={() => setStatus(v)}>
                {label}
              </FilterBtn>
            ))}
          </div>
          <div className="inline-flex rounded-lg border border-stone-200 bg-white p-0.5 text-xs">
            {(
              [["all", "全部型別"], ["generator", "生成型"], ["processor", "處理型"], ["action", "動作型"]] as const
            ).map(([v, label]) => (
              <FilterBtn key={v} active={type === v} onClick={() => setType(v)}>
                {label}
              </FilterBtn>
            ))}
          </div>
        </div>

        {/* category chips */}
        <div className="flex flex-wrap gap-1.5">
          <CatChip active={cat === "all"} onClick={() => setCat("all")}>
            全部方向 <b>{all.length}</b>
          </CatChip>
          {categories.map((c) => (
            <CatChip key={c.key} active={cat === c.key} onClick={() => setCat(c.key)}>
              {c.label} <b>{c.count}</b>
            </CatChip>
          ))}
        </div>
      </div>

      {modules && filtered.length === 0 ? (
        <p className="mt-8 text-center text-sm text-stone-400">沒有符合條件的模組。</p>
      ) : null}

      <div className="mt-6 space-y-8">
        {grouped.map((group) => (
          <section key={group.label}>
            <div className="flex items-baseline gap-2">
              <h2 className="db-section-title">{group.label}</h2>
              <span className="text-xs text-stone-400">{group.items.length} 個模組</span>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {group.items.map((m) => (
                <ModuleCard key={m.id} m={m} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </AppShell>
  );
}

function Stat({ n, label, color }: { n: number; label: string; color?: string }) {
  return (
    <div className="px-4 py-3 text-center sm:text-left">
      <div className="font-display text-xl font-semibold tabular-nums" style={{ color: color || "#1b1a17" }}>
        {n}
      </div>
      <div className="text-[11px] text-stone-400">{label}</div>
    </div>
  );
}

function FilterBtn({
  active, onClick, children,
}: {
  active: boolean; onClick: () => void; children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-md px-3 py-1.5 font-medium transition"
      style={active ? { background: "#1b1a17", color: "#f4f1ec" } : { color: "#8a8275" }}
    >
      {children}
    </button>
  );
}

function CatChip({
  active, onClick, children,
}: {
  active: boolean; onClick: () => void; children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full border px-3 py-1 text-xs transition"
      style={
        active
          ? { background: "#8c3b2e", color: "#f8f4ee", borderColor: "#8c3b2e" }
          : { background: "var(--card)", color: "#6b6457", borderColor: "var(--line)" }
      }
    >
      {children}
    </button>
  );
}

function ModuleCard({ m }: { m: ModuleSpecItem }) {
  const ts = TYPE_STYLE[m.module_type] ?? TYPE_STYLE.processor;
  const scenarios = m.applicable_scenarios.includes("*")
    ? []
    : m.applicable_scenarios.map((s) => SCENARIO_LABEL[s] || s);
  return (
    <div
      className="db-card flex flex-col p-4"
      style={!m.implemented ? { borderStyle: "dashed", opacity: 0.92 } : undefined}
    >
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
      <p className="mt-2 flex-1 text-xs leading-relaxed text-stone-600">{m.description}</p>

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
        {scenarios.map((s) => (
          <span key={s} className="rounded bg-[#e7eef9] px-1.5 py-0.5 text-[10px] font-medium text-[#2f5290]">
            {s}
          </span>
        ))}
        {m.dependencies.length ? (
          <span
            className="rounded bg-stone-100 px-1.5 py-0.5 text-[10px] text-stone-500"
            title={`依賴：${m.dependencies.join("、")}`}
          >
            依賴 {m.dependencies.length}
          </span>
        ) : null}
      </div>

      {m.endpoint ? (
        <p className="mt-2 font-mono text-[10px] leading-relaxed text-stone-400">{m.endpoint}</p>
      ) : null}
    </div>
  );
}
