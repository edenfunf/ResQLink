"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import { api } from "@/lib/api";
import type {
  ArtifactType,
  IncidentDetail,
  PublicationItem,
  ReviewTaskItem,
} from "@/lib/types";

const ACCENT = "#3a7d44";
const LINE_TYPES: ArtifactType[] = ["line_broadcast"];

type Broadcast = {
  id: string;
  status: string;
  risk_level: string;
  content: Record<string, any>;
  review: ReviewTaskItem | null;
  publication: PublicationItem | null;
};

export default function LineAdminPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [incident, setIncident] = useState<IncidentDetail | null>(null);
  const [items, setItems] = useState<Broadcast[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<"manage" | "preview">("manage");
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      new URLSearchParams(window.location.search).get("view") === "preview"
    ) {
      setView("preview");
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [inc, arts, revs, pubs] = await Promise.all([
        api.getIncident(id),
        api.listArtifacts({ incident_id: id, limit: 100 }),
        api.listReviews({ incident_id: id, limit: 100 }),
        api.listPublications(id),
      ]);
      const ln = arts.items.filter((a) => LINE_TYPES.includes(a.artifact_type));
      const detailed = await Promise.all(
        ln.map(async (a) => {
          const d = await api.getArtifact(a.id);
          return {
            id: a.id,
            status: a.status,
            risk_level: a.risk_level,
            content: d.content,
            review:
              revs.items.find((r) => r.artifact_id === a.id && r.status === "pending") ??
              null,
            publication: pubs.items.find((p) => p.artifact_id === a.id) ?? null,
          } as Broadcast;
        })
      );
      setIncident(inc);
      setItems(detailed);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function approve(b: Broadcast) {
    if (!b.review) return;
    setBusy(b.id);
    try {
      await api.approveReview(b.review.id);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function send(b: Broadcast) {
    setBusy(b.id);
    try {
      await api.publishArtifact(b.id, "line");
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const place = incident
    ? [incident.location.county, incident.location.town, incident.location.river]
        .filter(Boolean)
        .join("")
    : "";
  const accountName = `${place}救災資訊`;
  const approved = items.filter((b) => b.status === "approved");
  const pending = items.filter((b) => b.status === "pending_review").length;
  const sent = items.filter((b) => b.publication).length;

  return (
    <AppShell>
      <Link
        href={`/incidents/${id}`}
        className="text-sm text-stone-400 transition hover:text-stone-700"
      >
        ← 事件詳情
      </Link>

      <section className="db-card mt-3 p-6">
        <div className="flex items-center gap-4">
          <span
            className="grid h-16 w-16 place-items-center rounded-2xl text-2xl font-bold text-white shadow-sm"
            style={{ background: ACCENT }}
          >
            L
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-display text-xl font-semibold text-stone-900">
                {accountName}
              </h1>
              <span
                className="rounded-full px-2 py-0.5 text-[11px] font-medium text-white"
                style={{ background: ACCENT }}
              >
                LINE 官方帳號
              </span>
            </div>
            <p className="mt-0.5 text-xs text-stone-400">
              模擬推播後台 · LINE Official Account · 由 災鏈 ResQLink 生成
            </p>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap gap-6 text-sm">
          <Stat label="推播訊息" value={items.length} />
          <Stat label="已發送" value={sent} />
          <Stat label="待審核" value={pending} />
          <Stat label="可發送" value={Math.max(approved.length - sent, 0)} />
        </div>
      </section>

      <div className="mt-4 inline-flex rounded-lg border border-stone-200 bg-[var(--card)] p-1 text-sm">
        {(["manage", "preview"] as const).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => setView(v)}
            className="rounded-md px-4 py-1.5 font-medium transition"
            style={view === v ? { background: ACCENT, color: "#fff" } : { color: "#6b6457" }}
          >
            {v === "manage" ? "推播管理" : "手機預覽"}
          </button>
        ))}
      </div>

      {error ? (
        <p className="mt-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700 ring-1 ring-inset ring-rose-100">
          {error}
        </p>
      ) : null}

      {loading ? (
        <div className="db-card mt-4 h-40 animate-pulse bg-stone-100/60" />
      ) : items.length === 0 ? (
        <div className="db-card mt-4 grid place-items-center p-12 text-center">
          <p className="text-stone-700">此事件尚未生成任何 LINE 推播訊息。</p>
          <p className="mt-1.5 text-sm text-stone-400">
            到 AI 編排或事件詳情頁生成「LINE 推播訊息」後再回來管理。
          </p>
        </div>
      ) : view === "manage" ? (
        <div className="mt-4 space-y-3">
          {items.map((b) => (
            <BroadcastRow
              key={b.id}
              b={b}
              busy={busy === b.id}
              onApprove={() => approve(b)}
              onSend={() => send(b)}
            />
          ))}
        </div>
      ) : (
        <PhonePreview accountName={accountName} items={approved} />
      )}
    </AppShell>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="font-display text-lg font-semibold text-stone-900">{value}</div>
      <div className="text-xs text-stone-400">{label}</div>
    </div>
  );
}

function PublishedTag({ pub }: { pub: PublicationItem }) {
  const real = pub.connector !== "simulated";
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5 rounded-lg bg-[#e8efdd] px-3 py-1.5 text-xs text-[#4a6139]">
      <span
        className="rounded px-1.5 py-0.5 text-[10px] font-semibold"
        style={real ? { background: "#3a7d44", color: "#fff" } : { background: "#cdd3bc" }}
      >
        {real ? "真實" : "模擬"}
      </span>
      ✓ 已發送{pub.external_ref ? ` · ref ${pub.external_ref}` : ""}
    </span>
  );
}

function BroadcastRow({
  b,
  busy,
  onApprove,
  onSend,
}: {
  b: Broadcast;
  busy: boolean;
  onApprove: () => void;
  onSend: () => void;
}) {
  const text = (b.content.text as string) || "";
  const quick: string[] = Array.isArray(b.content.quick_replies)
    ? b.content.quick_replies
    : [];
  const pill =
    b.status === "approved"
      ? { t: "已通過", fg: "#4a6139", bg: "#e8efdd" }
      : b.status === "rejected"
      ? { t: "已退回", fg: "#8a4a3a", bg: "#f6e3dd" }
      : { t: "待審核", fg: "#2f5290", bg: "#e7eef9" };

  return (
    <article className="db-card db-reveal p-5">
      <div className="flex items-center gap-2">
        <span className="db-chip" style={{ background: "#e9f2ea", color: ACCENT }}>
          推播訊息
        </span>
        <span
          className="rounded-full px-2 py-0.5 text-[11px] font-medium"
          style={{ background: pill.bg, color: pill.fg }}
        >
          {pill.t}
        </span>
      </div>

      <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-stone-700">
        {text}
      </p>

      {quick.length ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {quick.map((q) => (
            <span
              key={q}
              className="rounded-full border px-3 py-1 text-xs"
              style={{ borderColor: ACCENT, color: ACCENT }}
            >
              {q}
            </span>
          ))}
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-stone-100 pt-3">
        {b.status === "pending_review" ? (
          <button
            type="button"
            onClick={onApprove}
            disabled={busy}
            className="db-btn db-btn-emerald text-xs"
          >
            {busy ? "處理中…" : "審核通過"}
          </button>
        ) : null}
        {b.status === "approved" && !b.publication ? (
          <button
            type="button"
            onClick={onSend}
            disabled={busy}
            className="db-btn text-xs text-white"
            style={{ background: ACCENT }}
          >
            {busy ? "發送中…" : "推播發送"}
          </button>
        ) : null}
        {b.publication ? <PublishedTag pub={b.publication} /> : null}
        {b.status === "pending_review" ? (
          <span className="text-xs text-stone-400">需審核通過後才能發送</span>
        ) : null}
      </div>

      {b.publication?.detail ? (
        <p className="mt-2 text-[11px] leading-snug text-stone-400">{b.publication.detail}</p>
      ) : null}
    </article>
  );
}

function PhonePreview({
  accountName,
  items,
}: {
  accountName: string;
  items: Broadcast[];
}) {
  return (
    <div className="mt-4">
      <p className="mb-4 text-xs text-stone-400">
        以下為訂閱者手機上收到的樣子（僅顯示審核通過的訊息）。正式上線時可綁定真實 LINE 官方帳號。
      </p>
      <div className="mx-auto w-full max-w-sm rounded-[2.2rem] border-[10px] border-stone-900 bg-[#8cabd9] shadow-xl">
        {/* status bar */}
        <div className="flex items-center justify-between rounded-t-[1.4rem] px-5 pt-2 text-[11px] text-white/90">
          <span>9:41</span>
          <span>● ● ●</span>
        </div>
        {/* chat header */}
        <div
          className="flex items-center gap-2 px-4 py-2 text-white"
          style={{ background: ACCENT }}
        >
          <span className="grid h-7 w-7 place-items-center rounded-full bg-white/20 text-xs font-bold">
            L
          </span>
          <span className="text-sm font-semibold">{accountName}</span>
        </div>
        {/* messages */}
        <div className="min-h-[360px] space-y-3 px-3 py-4">
          {items.length === 0 ? (
            <p className="mt-24 text-center text-sm text-white/80">
              尚無審核通過的推播訊息。
            </p>
          ) : (
            items.map((b, idx) => {
              const text = (b.content.text as string) || "";
              const quick: string[] = Array.isArray(b.content.quick_replies)
                ? b.content.quick_replies
                : [];
              return (
                <div
                  key={b.id}
                  className="db-reveal"
                  style={{ animationDelay: `${Math.min(idx * 90, 450)}ms` }}
                >
                  <div className="flex items-end gap-1.5">
                    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-[10px] font-bold text-white" style={{ background: ACCENT }}>
                      L
                    </span>
                    <div className="max-w-[80%] rounded-2xl rounded-bl-sm bg-white px-3 py-2 text-[13px] leading-relaxed text-stone-800 shadow-sm">
                      <p className="whitespace-pre-line">{text}</p>
                    </div>
                  </div>
                  {quick.length ? (
                    <div className="ml-7 mt-2 flex flex-wrap gap-1.5">
                      {quick.map((q) => (
                        <span
                          key={q}
                          className="rounded-full bg-white/90 px-3 py-1 text-[11px] font-medium"
                          style={{ color: ACCENT }}
                        >
                          {q}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })
          )}
        </div>
        {/* input bar */}
        <div className="flex items-center gap-2 rounded-b-[1.4rem] bg-white px-4 py-2.5">
          <div className="h-7 flex-1 rounded-full bg-stone-100" />
          <span className="text-xs text-stone-300">傳送</span>
        </div>
      </div>
    </div>
  );
}
