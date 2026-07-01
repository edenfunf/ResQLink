"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import Reveal from "@/components/Reveal";
import Skeleton from "@/components/Skeleton";
import { api } from "@/lib/api";
import type { ConnectorItem, IngestResult } from "@/lib/types";

const TYPE_LABEL: Record<string, string> = { alert: "警報來源", dataset: "資料集" };

export default function ConnectorsPage() {
  const [items, setItems] = useState<ConnectorItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, IngestResult | string>>({});

  const load = useCallback(() => {
    api
      .listConnectors()
      .then((r) => setItems(r.items))
      .catch((e) => setError((e as Error).message));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function runDemo(id: string) {
    setBusy(id);
    setResults((r) => ({ ...r, [id]: undefined as never }));
    try {
      const res = await api.connectorDemo(id);
      setResults((r) => ({ ...r, [id]: res }));
    } catch (e) {
      setResults((r) => ({ ...r, [id]: (e as Error).message }));
    } finally {
      setBusy(null);
    }
  }

  async function runSync(id: string) {
    setBusy(id);
    try {
      const res = await api.connectorSync(id);
      setResults((r) => ({ ...r, [id]: res }));
    } catch (e) {
      setResults((r) => ({ ...r, [id]: (e as Error).message }));
    } finally {
      setBusy(null);
    }
  }

  return (
    <AppShell>
      <span className="db-eyebrow block">Open Data Connectors</span>
      <h1 className="font-display mt-1 text-2xl font-semibold tracking-tight text-stone-900">
        開放資料介接
      </h1>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-stone-500">
        把官方開放資料（中央氣象署、NCDR 災害示警等）映射成標準災害事件。設定授權碼後可即時同步；
        未設定也能用內建範例警報一鍵建立事件展示。
      </p>

      {error ? (
        <p className="mt-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>
      ) : null}

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        {!items
          ? Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-44" />)
          : items.map((c, idx) => {
              const res = results[c.id];
              return (
                <Reveal key={c.id} delay={idx * 60}>
                  <div className="db-card flex h-full flex-col p-5">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-semibold text-stone-900">{c.name}</h3>
                      <span
                        className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold"
                        style={
                          c.source_type === "alert"
                            ? { background: "#efddd3", color: "#8c3b2e" }
                            : { background: "#e5e6ea", color: "#565a66" }
                        }
                      >
                        {TYPE_LABEL[c.source_type]}
                      </span>
                    </div>
                    <p className="mt-2 flex-1 text-sm leading-relaxed text-stone-500">
                      {c.description}
                    </p>

                    <div className="mt-2 flex items-center gap-2 text-[11px]">
                      <span
                        className="inline-flex items-center gap-1 rounded-full px-2 py-0.5"
                        style={
                          c.live_enabled
                            ? { background: "#e7ebdd", color: "#4f5b3c" }
                            : { background: "#f3efe7", color: "#a89e8e" }
                        }
                      >
                        <span className="h-1.5 w-1.5 rounded-full" style={{ background: c.live_enabled ? "#6f7a4e" : "#cabfac" }} />
                        {c.live_enabled ? "即時同步已啟用" : "即時同步未設定"}
                      </span>
                      <a href={c.homepage} target="_blank" rel="noreferrer" className="font-mono text-stone-400 hover:text-[#8c3b2e]">
                        來源 ↗
                      </a>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      {c.source_type === "alert" && c.has_sample ? (
                        <button
                          type="button"
                          onClick={() => runDemo(c.id)}
                          disabled={busy === c.id}
                          className="db-btn db-btn-primary"
                        >
                          {busy === c.id ? (
                            <>
                              <span className="db-spinner h-3.5 w-3.5" /> 匯入中…
                            </>
                          ) : (
                            "一鍵匯入範例警報"
                          )}
                        </button>
                      ) : null}
                      {c.source_type === "alert" && c.live_enabled ? (
                        <button
                          type="button"
                          onClick={() => runSync(c.id)}
                          disabled={busy === c.id}
                          className="db-btn db-btn-ghost"
                        >
                          即時同步
                        </button>
                      ) : null}
                      {c.source_type === "dataset" ? (
                        <a href={c.homepage} target="_blank" rel="noreferrer" className="db-btn db-btn-ghost">
                          前往資料平台 ↗
                        </a>
                      ) : null}
                    </div>

                    {res !== undefined ? (
                      <div className="db-pop mt-3 rounded-lg bg-stone-50 px-3 py-2 text-xs">
                        {typeof res === "string" ? (
                          <span className="text-rose-600">{res}</span>
                        ) : (
                          <span className="text-stone-600">
                            建立 {res.created_count} · 已存在 {res.skipped} · 失敗 {res.failed}
                            {res.created.length > 0 ? (
                              <Link href={`/incidents/${res.created[0]}`} className="ml-2 font-medium text-[#8c3b2e]">
                                查看事件 →
                              </Link>
                            ) : null}
                          </span>
                        )}
                      </div>
                    ) : null}
                  </div>
                </Reveal>
              );
            })}
      </div>

      <p className="mt-6 text-xs text-stone-400">
        提示：中央氣象署授權碼可至 opendata.cwa.gov.tw 免費申請，填入後端 <code className="db-chip">CWA_API_KEY</code> 即可啟用即時同步。
      </p>
    </AppShell>
  );
}
