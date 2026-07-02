"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/api";
import type {
  AgentExecuteResponse,
  AgentPlanResponse,
  DeliverableItem,
  ModuleProposal,
} from "@/lib/types";
import StatusBadge from "./StatusBadge";
import DeliverableCard from "./DeliverableCard";

const EXAMPLES = [
  "花蓮外海發生規模7.2強烈地震，市區傳出建物倒塌與民眾受困",
  "強烈颱風即將登陸，沿海鄉鎮預警淹水與停電",
  "馬太鞍溪上游堰塞湖溢流，下游光復鄉淹水",
];

const STATUS_LABEL: Record<string, string> = {
  created: "已生成",
  skipped: "已存在",
  failed: "失敗",
};

const THINKING_STEPS = ["解析災情描述", "判定災別與嚴重度", "查詢模組目錄", "評估建議模組"];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Persist the working state so navigating to a deliverable's front/admin page
// and pressing "back" keeps the disaster description, plan and generated result.
const STORAGE_KEY = "resqlink.agent-chat.v1";

type PersistedState = {
  message: string;
  plan: AgentPlanResponse | null;
  selected: string[];
  result: AgentExecuteResponse | null;
  deliverables: DeliverableItem[] | null;
  showModules: boolean;
};

export default function AgentChat() {
  const [message, setMessage] = useState("");
  const [planning, setPlanning] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [thinkStep, setThinkStep] = useState(0);

  const [plan, setPlan] = useState<AgentPlanResponse | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [result, setResult] = useState<AgentExecuteResponse | null>(null);
  const [deliverables, setDeliverables] = useState<DeliverableItem[] | null>(null);
  const [showModules, setShowModules] = useState(false);
  // parallel-generation animation: the modules being generated + all-done flash
  const [genMods, setGenMods] = useState<ModuleProposal[]>([]);
  const [genDone, setGenDone] = useState(false);
  const [ready, setReady] = useState(false);
  const resultRef = useRef<HTMLDivElement | null>(null);

  const proposals = plan?.proposals ?? [];
  // runnable now vs. the rest of the capability map (built-in services /
  // roadmap blocks); older persisted plans lack the flag → treat as runnable
  const runnable = proposals.filter((p) => p.executable !== false);
  const extras = proposals.filter((p) => p.executable === false);
  const byId = useMemo(() => {
    const m = new Map<string, ModuleProposal>();
    proposals.forEach((p) => m.set(p.id, p));
    return m;
  }, [proposals]);

  // cycle the "thinking" steps while planning
  useEffect(() => {
    if (!planning) return;
    setThinkStep(0);
    const t = setInterval(
      () => setThinkStep((s) => Math.min(s + 1, THINKING_STEPS.length - 1)),
      280
    );
    return () => clearInterval(t);
  }, [planning]);

  // restore a prior session (survives back-navigation from a deliverable page)
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) {
        const s = JSON.parse(raw) as PersistedState;
        if (s.message) setMessage(s.message);
        if (s.plan) setPlan(s.plan);
        if (s.selected) setSelected(new Set(s.selected));
        if (s.result) setResult(s.result);
        if (s.deliverables) setDeliverables(s.deliverables);
        if (s.showModules) setShowModules(true);
      }
    } catch {
      /* ignore corrupt storage */
    }
    setReady(true);
  }, []);

  // persist working state after hydration; the `ready` gate stops the empty
  // first render from clobbering what we just restored.
  useEffect(() => {
    if (!ready) return;
    try {
      const payload: PersistedState = {
        message,
        plan,
        selected: Array.from(selected),
        result,
        deliverables,
        showModules,
      };
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      /* ignore quota / serialization errors */
    }
  }, [ready, message, plan, selected, result, deliverables, showModules]);

  function handleReset() {
    setMessage("");
    setPlan(null);
    setSelected(new Set());
    setResult(null);
    setDeliverables(null);
    setShowModules(false);
    setError(null);
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }

  async function handlePlan(text?: string) {
    const msg = (text ?? message).trim();
    if (!msg) return;
    if (text) setMessage(text);
    setPlanning(true);
    setError(null);
    setResult(null);
    setDeliverables(null);
    setPlan(null);
    try {
      // small floor so the "thinking" animation reads intentionally
      const [res] = await Promise.all([api.agentPlan(msg), sleep(1150)]);
      setPlan(res);
      setSelected(
        new Set(
          res.proposals
            .filter((p) => p.recommended && !p.already_generated)
            .map((p) => p.id)
        )
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPlanning(false);
    }
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }
  const selectRecommended = () =>
    setSelected(new Set(runnable.filter((p) => p.recommended).map((p) => p.id)));
  const selectAll = () => setSelected(new Set(runnable.map((p) => p.id)));
  const selectNone = () => setSelected(new Set());

  async function handleExecute() {
    if (!plan || selected.size === 0) return;
    setGenMods(runnable.filter((p) => selected.has(p.id)));
    setGenDone(false);
    setExecuting(true);
    setError(null);
    try {
      // floor keeps the parallel-generation animation readable even when the
      // backend answers fast; bars then snap to done together.
      const [res] = await Promise.all([
        api.agentExecute(plan.incident.id, Array.from(selected)),
        sleep(2400),
      ]);
      setGenDone(true);
      await sleep(800);
      setResult(res);
      // demo mode: populate the incident with citizen reports + resources so the
      // generated rescue site / backends have rich data to show immediately.
      try {
        await api.seedDemoActivity(plan.incident.id);
      } catch {
        /* best-effort demo seeding */
      }
      try {
        const d = await api.getDeliverables(plan.incident.id);
        setDeliverables(d.items);
      } catch {
        setDeliverables(null);
      }
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 50);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setExecuting(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* input */}
      <div className="db-card p-5">
        <div className="flex items-center justify-between">
          <label className="db-label">描述目前的災害狀況</label>
          {plan || result ? (
            <button
              type="button"
              onClick={handleReset}
              className="text-xs text-stone-400 transition hover:text-[#8c3b2e]"
            >
              重新開始
            </button>
          ) : null}
        </div>
        <textarea
          className="db-input mt-1"
          rows={3}
          placeholder="例如：花蓮外海發生規模7.2地震，市區傳出建物倒塌…"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => handlePlan()}
            disabled={planning || !message.trim()}
            className="db-btn db-btn-primary"
          >
            {planning ? (
              <>
                <span className="db-spinner h-3.5 w-3.5" /> 規劃中…
              </>
            ) : (
              "讓 Agent 規劃"
            )}
          </button>
          <span className="text-xs text-stone-400">或試試：</span>
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => handlePlan(ex)}
              disabled={planning}
              className="db-chip transition hover:text-[#8c3b2e]"
            >
              {ex.slice(0, 12)}…
            </button>
          ))}
        </div>
        <p className="mt-3 text-xs leading-relaxed text-stone-400">
          Agent 只負責「理解需求 → 從模組目錄提案 → 平行生成」，所有產出仍須人工審核才公開，
          不會繞過審核閘門。
        </p>
      </div>

      {/* thinking */}
      {planning ? (
        <div className="db-card db-reveal p-5">
          <span className="db-eyebrow">Agent 思考中</span>
          <ul className="mt-3 space-y-2">
            {THINKING_STEPS.map((s, i) => {
              const done = i < thinkStep;
              const active = i === thinkStep;
              return (
                <li key={s} className="flex items-center gap-2.5 text-sm">
                  <span
                    className="grid h-5 w-5 place-items-center rounded-full text-[10px]"
                    style={
                      done
                        ? { background: "#e7ebdd", color: "#4f5b3c" }
                        : active
                        ? { background: "#1b1a17", color: "#f4f1ec" }
                        : { background: "#efeae0", color: "#a89e8e" }
                    }
                  >
                    {done ? "✓" : active ? <span className="db-spinner h-2.5 w-2.5" /> : i + 1}
                  </span>
                  <span className={done || active ? "text-stone-700" : "text-stone-400"}>{s}</span>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {error ? (
        <p className="db-reveal rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700 ring-1 ring-inset ring-rose-100">
          {error}
        </p>
      ) : null}

      {/* plan result */}
      {plan && !planning ? (
        <div className="db-card db-reveal p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <span className="db-eyebrow">已標準化事件</span>
              <h3 className="font-display mt-1 text-lg font-semibold text-stone-900">
                {plan.incident.title}
              </h3>
              <p className="mt-1 font-mono text-xs text-stone-400">slug · {plan.incident.slug}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="db-chip">{plan.incident.scenario_type}</span>
              <StatusBadge value={plan.incident.severity} prefix="嚴重度" />
              <span className="db-chip">
                意圖解析：{plan.intent_mode === "ai" ? "AI" : plan.intent_mode === "existing" ? "既有事件" : "關鍵字"}
              </span>
            </div>
          </div>

          {plan.note ? (
            <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 ring-1 ring-inset ring-amber-100">
              {plan.note}
            </p>
          ) : null}

          <div className="mt-4 flex items-center justify-between">
            <span className="db-eyebrow">建議模組（{selected.size} / {runnable.length} 已選）</span>
            <div className="flex gap-2 text-xs">
              <button type="button" onClick={selectRecommended} className="text-stone-500 hover:text-[#8c3b2e]">只選建議</button>
              <button type="button" onClick={selectAll} className="text-stone-500 hover:text-[#8c3b2e]">全選</button>
              <button type="button" onClick={selectNone} className="text-stone-500 hover:text-[#8c3b2e]">清除</button>
            </div>
          </div>

          <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
            {runnable.map((p, idx) => {
              const checked = selected.has(p.id);
              return (
                <label
                  key={p.id}
                  className={`db-reveal flex cursor-pointer gap-3 rounded-xl border p-3 transition ${
                    checked ? "border-[#c5705f] bg-[#faf3ef]" : "border-stone-200 hover:border-stone-300"
                  }`}
                  style={{ animationDelay: `${Math.min(idx * 45, 360)}ms` }}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(p.id)}
                    className="mt-1 h-4 w-4 shrink-0 accent-[#8c3b2e]"
                  />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-medium text-stone-900">{p.name}</span>
                      {p.recommended ? (
                        <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold" style={{ background: "#efddd3", color: "#8c3b2e" }}>建議</span>
                      ) : null}
                      {p.already_generated ? (
                        <span className="rounded bg-stone-100 px-1.5 py-0.5 text-[10px] text-stone-500">已生成</span>
                      ) : null}
                    </div>
                    <p className="mt-0.5 text-xs leading-relaxed text-stone-500">{p.reason}</p>
                    <p className="mt-1 font-mono text-[10px] text-stone-400">{p.category_label} · 風險 {p.risk_level}</p>
                  </div>
                </label>
              );
            })}
          </div>

          {/* the rest of the capability map — built-in services + roadmap */}
          {extras.length > 0 ? (
            <div className="mt-5 rounded-xl border border-dashed border-stone-300 bg-stone-50/50 p-3.5">
              <div className="flex flex-wrap items-baseline justify-between gap-1">
                <span className="db-eyebrow">Agent 同時掌握的能力（{extras.length}）</span>
                <span className="text-[11px] text-stone-400">
                  服務型能力已內建運行；規劃中積木為路線圖，實作後即可勾選生成
                </span>
              </div>
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {extras.map((p) => (
                  <span
                    key={p.id}
                    title={`${p.category_label}｜${p.reason}`}
                    className="inline-flex cursor-help items-center gap-1.5 rounded-full border bg-white px-2.5 py-1 text-[11px] text-stone-600"
                    style={
                      p.implemented
                        ? { borderColor: "#cdd3bc" }
                        : { borderColor: "#e0d9cc", borderStyle: "dashed", color: "#8a8275" }
                    }
                  >
                    {p.name}
                    <span
                      className="rounded px-1 py-px text-[9.5px] font-semibold"
                      style={
                        p.implemented
                          ? { background: "#e7ebdd", color: "#4f5b3c" }
                          : { background: "#f3efe7", color: "#a89e8e" }
                      }
                    >
                      {p.implemented ? "內建服務" : "規劃中"}
                    </span>
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          <button
            type="button"
            onClick={handleExecute}
            disabled={executing || selected.size === 0}
            className="db-btn db-btn-primary mt-4 w-full"
          >
            {executing ? (
              <>
                <span className="db-spinner h-3.5 w-3.5" /> 平行生成中…
              </>
            ) : (
              `平行生成選定的 ${selected.size} 個模組`
            )}
          </button>
        </div>
      ) : null}

      {/* parallel generation animation */}
      {executing && !result && genMods.length > 0 ? (
        <div className="db-card db-reveal p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <span className="db-eyebrow">Parallel Generation</span>
              <h3 className="font-display mt-1 text-lg font-semibold text-stone-900">
                Agent 正在平行生成 {genMods.length} 個模組
              </h3>
            </div>
            {genDone ? (
              <span className="db-pop text-sm font-semibold text-[#4a6139]">全部完成 ✓</span>
            ) : (
              <span className="flex items-center gap-2 text-xs text-stone-400">
                <span className="db-spinner h-3.5 w-3.5" /> 各模組獨立執行、失敗隔離
              </span>
            )}
          </div>
          <div className="mt-4 grid gap-x-8 gap-y-3.5 sm:grid-cols-2">
            {genMods.map((m, i) => (
              <GenRow key={m.id} name={m.name} idx={i} done={genDone} />
            ))}
          </div>
          <p className="mt-4 text-[11px] leading-relaxed text-stone-400">
            產出一律為「待審核」，通過審核閘門後才對外顯示。
          </p>
        </div>
      ) : null}

      {/* execute result — outcome-first */}
      {result ? (
        <div ref={resultRef} className="space-y-4">
          <div className="db-card db-reveal p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <span className="db-eyebrow">已產出成果</span>
                <h3 className="font-display mt-1 text-lg font-semibold text-stone-900">
                  Agent 已平行串接好以下救災成果
                </h3>
              </div>
              <span className="text-xs text-stone-500">
                新增 {result.created_count} · 已存在 {result.skipped_count}
                {result.failed_count ? ` · 失敗 ${result.failed_count}` : ""} 個模組
              </span>
            </div>

            {deliverables ? (
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                {deliverables
                  .filter((d) => d.status !== "empty")
                  .map((d, idx) => (
                    <DeliverableCard key={d.key} item={d} delayMs={Math.min(idx * 80, 480)} />
                  ))}
              </div>
            ) : null}

            <p className="mt-4 text-xs leading-relaxed text-stone-400">
              所有產出皆為「待審核」狀態。請從各成果的「後台」逐一審核，通過後前台才會對外顯示；
              Agent 不會繞過審核閘門。
            </p>

            <button
              type="button"
              onClick={() => setShowModules((v) => !v)}
              className="mt-3 text-xs font-medium text-stone-500 transition hover:text-[#8c3b2e]"
            >
              {showModules ? "隱藏模組明細 ▲" : `查看模組明細（${result.results.length}）▼`}
            </button>

            {showModules ? (
              <ul className="mt-3 space-y-1.5">
                {result.results.map((r, idx) => (
                  <li
                    key={r.module_id}
                    className="db-pop flex items-center justify-between rounded-lg bg-stone-50 px-3 py-2 text-sm"
                    style={{ animationDelay: `${Math.min(idx * 40, 320)}ms` }}
                  >
                    <span className="font-mono text-xs text-stone-600">
                      {byId.get(r.module_id)?.name || r.module_id}
                    </span>
                    <span
                      className={`text-xs font-medium ${
                        r.status === "failed" ? "text-rose-600" : r.status === "created" ? "text-emerald-700" : "text-stone-500"
                      }`}
                    >
                      {r.status === "created" ? "✓ " : ""}
                      {STATUS_LABEL[r.status] || r.status}
                      {r.detail ? `（${r.detail}）` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** One row in the parallel-generation animation: staggered start, a progress
 * bar that ramps then crawls, snapping to full + ✓ when the batch resolves. */
function GenRow({ name, idx, done }: { name: string; idx: number; done: boolean }) {
  const dur = 1.8 + ((idx * 7) % 5) * 0.45; // pseudo-random 1.8s–3.6s per module
  const delay = idx * 0.14;
  return (
    <div className="db-pop" style={{ animationDelay: `${idx * 60}ms` }}>
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="truncate font-medium text-stone-700">{name}</span>
        {done ? (
          <span className="db-pop shrink-0 font-semibold text-[#4a6139]">✓ 完成</span>
        ) : (
          <span className="db-genpulse shrink-0 text-stone-400" style={{ animationDelay: `${delay}s` }}>
            生成中…
          </span>
        )}
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-stone-200/70">
        {done ? (
          <span className="block h-full w-full rounded-full bg-[#566246]" />
        ) : (
          <span
            className="db-genbar block h-full w-full rounded-full bg-[#8c3b2e]"
            style={{ "--gen-dur": `${dur}s`, "--gen-delay": `${delay}s` } as React.CSSProperties}
          />
        )}
      </div>
    </div>
  );
}
