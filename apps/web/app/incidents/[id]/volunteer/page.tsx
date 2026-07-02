"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import {
  BlockRow,
  Stat,
  useReviewBlocks,
} from "@/components/DeliverableReview";
import { api } from "@/lib/api";
import type {
  ArtifactType,
  AssignmentItem,
  IncidentDetail,
  ResourceOfferItem,
} from "@/lib/types";

const ACCENT = "#6f6a3a";
const VOLUNTEER_TYPES: ArtifactType[] = [
  "volunteer_form",
  "volunteer_recruit_post",
  "volunteer_checkin",
  "volunteer_shift_schedule",
  "volunteer_insurance_roster",
  "skill_certification_registry",
  "corporate_volunteer_pack",
];

const OFFER_STATUS: Record<string, { t: string; fg: string; bg: string }> = {
  open: { t: "可調度", fg: "#4a6139", bg: "#e8efdd" },
  matched: { t: "已媒合", fg: "#2f5290", bg: "#e7eef9" },
  closed: { t: "已結案", fg: "#7c7264", bg: "#f1ece3" },
};

export default function VolunteerAdminPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const { blocks, loading, error, busy, decide } = useReviewBlocks(
    id,
    VOLUNTEER_TYPES
  );
  const [incident, setIncident] = useState<IncidentDetail | null>(null);
  const [offers, setOffers] = useState<ResourceOfferItem[]>([]);
  const [assignments, setAssignments] = useState<AssignmentItem[]>([]);
  const [view, setView] = useState<"manage" | "roster">("manage");

  const loadSide = useCallback(async () => {
    try {
      const [inc, res, asg] = await Promise.all([
        api.getIncident(id),
        api.listResources(id, { offer_type: "volunteer" }),
        api.listAssignments(id),
      ]);
      setIncident(inc);
      setOffers(res.items);
      setAssignments(asg.items);
    } catch {
      /* header/side data is best-effort */
    }
  }, [id]);

  useEffect(() => {
    loadSide();
  }, [loadSide]);

  const approvedCount = useMemo(
    () => blocks.filter((b) => b.status === "approved").length,
    [blocks]
  );
  const pending = blocks.filter((b) => b.status === "pending_review").length;
  const activeAssignments = assignments.filter(
    (a) => a.status === "assigned" || a.status === "in_progress"
  ).length;

  const frontPath = `/reports/${id}`;

  return (
    <AppShell>
      <Link
        href={`/incidents/${id}`}
        className="text-sm text-stone-400 transition hover:text-stone-700"
      >
        ← 事件詳情
      </Link>

      <section className="db-card mt-3 overflow-hidden">
        <div
          className="h-24 w-full"
          style={{ background: `linear-gradient(120deg, ${ACCENT}, #47431f)` }}
        />
        <div className="px-6 pb-5">
          <div className="-mt-9 flex items-end gap-4">
            <span
              className="grid h-20 w-20 place-items-center rounded-2xl border-4 border-[var(--card)] text-white shadow-sm"
              style={{ background: ACCENT }}
            >
              <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="9" cy="8" r="3" />
                <path d="M3.5 20a5.5 5.5 0 0 1 11 0M16 6.2a3 3 0 0 1 0 5.6M20.5 20a5.5 5.5 0 0 0-4-5.3" />
              </svg>
            </span>
            <div className="pb-1">
              <div className="flex items-center gap-2">
                <h1 className="font-display text-xl font-semibold text-stone-900">
                  志工招募
                </h1>
                <span
                  className="rounded-full px-2 py-0.5 text-[11px] font-medium text-white"
                  style={{ background: ACCENT }}
                >
                  志工調度
                </span>
              </div>
              <p className="mt-0.5 text-xs text-stone-400">
                模擬管理後台 · 志工報名與現場調度 · 由 災鏈 ResQLink 生成
              </p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-6 text-sm">
            <Stat label="志工元件" value={blocks.length} />
            <Stat label="已上線" value={approvedCount} />
            <Stat label="待審核" value={pending} />
            <Stat label="報名志工" value={offers.length} />
            <Stat label="進行中派工" value={activeAssignments} />
          </div>
        </div>
      </section>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex rounded-lg border border-stone-200 bg-[var(--card)] p-1 text-sm">
          {(["manage", "roster"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className="rounded-md px-4 py-1.5 font-medium transition"
              style={view === v ? { background: ACCENT, color: "#fff" } : { color: "#6b6457" }}
            >
              {v === "manage" ? "內容管理" : `志工名冊（${offers.length}）`}
            </button>
          ))}
        </div>
        <a
          href={frontPath}
          target="_blank"
          rel="noreferrer"
          className="db-btn text-xs text-white"
          style={{ background: ACCENT }}
        >
          開啟志工報名頁 ↗
        </a>
      </div>

      {error ? (
        <p className="mt-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700 ring-1 ring-inset ring-rose-100">
          {error}
        </p>
      ) : null}

      {view === "manage" ? (
        loading ? (
          <div className="db-card mt-4 h-40 animate-pulse bg-stone-100/60" />
        ) : blocks.length === 0 ? (
          <EmptyState
            what="志工"
            hint="到 AI 編排或事件詳情頁生成「志工報名表單 / 招募貼文 / 報到簽到」後再回來管理。"
          />
        ) : (
          <>
            <p className="mt-4 text-xs leading-relaxed text-stone-400">
              審核通過的志工元件才會對外顯示；審核就是上線閘門。
            </p>
            <div className="mt-3 space-y-3">
              {blocks.map((b) => (
                <BlockRow
                  key={b.id}
                  b={b}
                  accent={ACCENT}
                  busy={busy === b.id}
                  onApprove={() => decide(b, "approve")}
                  onReject={() => decide(b, "reject")}
                  approveLabel="審核通過（上線）"
                  approvedNote="✓ 已對外顯示"
                />
              ))}
            </div>
          </>
        )
      ) : offers.length === 0 ? (
        <EmptyState
          what="志工報名"
          hint="民眾從志工報名頁登記後，會列在這裡供現場調度。"
        />
      ) : (
        <div className="mt-4 space-y-2.5">
          <p className="text-xs leading-relaxed text-stone-400">
            以下為報名的志工（不含聯絡方式）。派工可於事件詳情頁的媒合面板建立。
          </p>
          {offers.map((o) => {
            const st = OFFER_STATUS[o.status] || OFFER_STATUS.open;
            return (
              <article
                key={o.id}
                className="db-card db-reveal flex flex-wrap items-center justify-between gap-3 p-4"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-stone-900">{o.item}</span>
                    {o.quantity != null ? (
                      <span className="db-chip" style={{ background: "#eeecdd", color: ACCENT }}>
                        {o.quantity} 人
                      </span>
                    ) : null}
                    <span
                      className="rounded-full px-2 py-0.5 text-[11px] font-medium"
                      style={{ background: st.bg, color: st.fg }}
                    >
                      {st.t}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-stone-500">
                    {[o.provider_name, o.address, o.available_time]
                      .filter(Boolean)
                      .join(" · ") || "—"}
                  </p>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}

function EmptyState({ what, hint }: { what: string; hint: string }) {
  return (
    <div className="db-card mt-4 grid place-items-center p-12 text-center">
      <p className="text-stone-700">此事件尚無{what}內容。</p>
      <p className="mt-1.5 text-sm text-stone-400">{hint}</p>
    </div>
  );
}
