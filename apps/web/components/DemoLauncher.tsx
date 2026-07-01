"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";

const TOUR = [
  { href: "/console", label: "指揮中心", text: "跨事件 KPI 與即時態勢總覽。" },
  { href: "/console/agent", label: "AI 編排", text: "一句話描述災情 → 提案模組 → 平行生成。" },
  { href: "/console/modules", label: "模組目錄", text: "27 個防災積木，依十大方向分類。" },
];

const DEMO_REPORTS = [
  { need_type: "trapped_person", description: "民宅二樓有人受困，需要救援", severity: "critical", lat: 23.972, lon: 121.602 },
  { need_type: "mud_removal", description: "一樓淤泥及膝，需要志工協助清理", severity: "high", lat: 23.967, lon: 121.598 },
  { need_type: "supply_need", description: "收容所缺飲用水與毛毯", severity: "medium", lat: 23.969, lon: 121.605 },
] as const;

const DEMO_RESOURCES = [
  { offer_type: "volunteer", item: "清淤", quantity: 8, lat: 23.968, lon: 121.6 },
  { offer_type: "supply", item: "飲用水", quantity: 300, lat: 23.97, lon: 121.601 },
] as const;

export default function DemoLauncher() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function runDemo() {
    setBusy(true);
    setError(null);
    try {
      setStep("建立事件並提案模組…");
      const plan = await api.agentPlan(
        "花蓮外海發生規模7.2強烈地震，光復市區傳出建物倒塌與民眾受困"
      );
      const iid = plan.incident.id;
      const picks = plan.proposals.filter((p) => p.recommended).map((p) => p.id);

      setStep("平行生成救災元件…");
      await api.agentExecute(iid, picks);

      setStep("人工審核並公開…");
      const reviews = await api.listReviews({ incident_id: iid, limit: 100 });
      for (const r of reviews.items) {
        if (r.status === "pending") await api.approveReview(r.id, "demo 自動審核");
      }

      setStep("灌入民眾通報…");
      for (const rep of DEMO_REPORTS) {
        await api.submitReport(iid, { ...rep });
      }

      setStep("登記志工與物資…");
      for (const res of DEMO_RESOURCES) {
        await api.submitResource(iid, { ...res });
      }

      setStep("完成，前往事件頁…");
      router.push(`/incidents/${iid}`);
      setOpen(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
      setStep(null);
    }
  }

  return (
    <div className="fixed bottom-5 right-5 z-30">
      {open ? (
        <div className="db-card db-reveal mb-3 w-80 overflow-hidden p-0 shadow-xl">
          <div
            className="flex items-center justify-between px-4 py-3"
            style={{ background: "#1b1a17", color: "#f4f1ec" }}
          >
            <span className="text-sm font-semibold">Demo 導覽</span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-stone-300 transition hover:text-white"
              aria-label="關閉"
            >
              ✕
            </button>
          </div>

          <div className="p-4">
            <button
              type="button"
              onClick={runDemo}
              disabled={busy}
              className="db-btn db-btn-accent w-full"
            >
              {busy ? (
                <>
                  <span className="db-spinner h-3.5 w-3.5" /> {step ?? "執行中…"}
                </>
              ) : (
                "✨ 一鍵載入展示資料"
              )}
            </button>
            <p className="mt-2 text-[11px] leading-relaxed text-stone-400">
              自動跑完整流程：地震事件 → AI 提案生成 → 審核公開 → 民眾通報 → 志工物資登記，
              再帶你進事件頁。
            </p>

            {error ? (
              <p className="mt-2 rounded-lg bg-rose-50 px-2.5 py-1.5 text-[11px] text-rose-700">
                {error}
              </p>
            ) : null}

            <div className="db-divider my-3" />
            <p className="db-eyebrow mb-2">逐頁導覽</p>
            <ul className="space-y-1.5">
              {TOUR.map((t, i) => (
                <li key={t.href}>
                  <Link
                    href={t.href}
                    onClick={() => setOpen(false)}
                    className="group flex items-start gap-2 rounded-lg px-2 py-1.5 transition hover:bg-stone-100"
                  >
                    <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-stone-100 text-[10px] font-semibold text-stone-500 group-hover:bg-[#efddd3] group-hover:text-[#8c3b2e]">
                      {i + 1}
                    </span>
                    <span>
                      <span className="text-sm font-medium text-stone-800">{t.label}</span>
                      <span className="block text-[11px] text-stone-400">{t.text}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="db-btn db-btn-primary shadow-lg"
        style={{ boxShadow: "0 12px 30px -10px rgba(27,26,23,0.5)" }}
      >
        {open ? "收合導覽" : "✨ Demo 導覽"}
      </button>
    </div>
  );
}
