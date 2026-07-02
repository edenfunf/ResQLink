"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import { api } from "@/lib/api";
import { useViewParam } from "@/lib/useViewParam";
import { buildFbOps, fbPostComments, fbPostMetrics } from "@/lib/demoContent";
import type { FbMessage, FbOps } from "@/lib/demoContent";
import type {
  ArtifactType,
  IncidentDetail,
  PublicationItem,
  ReviewTaskItem,
} from "@/lib/types";

const ACCENT = "#2f5fa8";
const OK = "#566246";
const WARN = "#b07d3c";
const FB_TYPES: ArtifactType[] = [
  "fb_page_post",
  "press_release",
  "clarification_notice",
  "ig_info_card",
  "media_kit",
  "community_group_pack",
  "press_conference_brief",
];

const TYPE_LABEL: Record<string, string> = {
  fb_page_post: "粉專貼文",
  press_release: "新聞稿 / 懶人包",
  clarification_notice: "澄清 / 闢謠",
  ig_info_card: "IG 資訊圖卡",
  media_kit: "媒體資料包",
  community_group_pack: "社區群組素材",
  press_conference_brief: "記者會口徑",
};

type Post = {
  id: string;
  artifact_type: string;
  status: string;
  risk_level: string;
  content: Record<string, any>;
  review: ReviewTaskItem | null;
  publication: PublicationItem | null;
};

function bodyText(c: Record<string, any>): string {
  if (typeof c.body === "string") return c.body;
  if (Array.isArray(c.body_paragraphs)) return c.body_paragraphs.join("\n\n");
  return "";
}
function headline(c: Record<string, any>, fallback: string): string {
  return (c.title as string) || (c.headline as string) || fallback;
}
function fmtAgo(min: number): string {
  if (min < 60) return `${min} 分鐘前`;
  if (min < 1440) return `${Math.round(min / 60)} 小時前`;
  return `${Math.round(min / 1440)} 天前`;
}
function fmtTime(iso?: string): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString("zh-TW", {
      month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false,
    });
  } catch {
    return "";
  }
}
function nf(n: number): string {
  return n >= 10000 ? `${(n / 10000).toFixed(1)} 萬` : n.toLocaleString();
}

export default function FbAdminPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [incident, setIncident] = useState<IncidentDetail | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useViewParam<"manage" | "inbox" | "preview">("manage", ["manage", "inbox", "preview"]);
  const [busy, setBusy] = useState<string | null>(null);
  // local, demo-only reply state for the inbox
  const [replied, setReplied] = useState<Record<number, boolean>>({});

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
      const fb = arts.items.filter((a) => FB_TYPES.includes(a.artifact_type));
      const detailed = await Promise.all(
        fb.map(async (a) => {
          const d = await api.getArtifact(a.id);
          const review =
            revs.items.find((r) => r.artifact_id === a.id && r.status === "pending") ??
            null;
          const publication =
            pubs.items.find((p) => p.artifact_id === a.id) ?? null;
          return {
            id: a.id,
            artifact_type: a.artifact_type,
            status: a.status,
            risk_level: a.risk_level,
            content: d.content,
            review,
            publication,
          } as Post;
        })
      );
      setIncident(inc);
      setPosts(detailed);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function approve(post: Post) {
    if (!post.review) return;
    setBusy(post.id);
    try {
      await api.approveReview(post.review.id);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function publish(post: Post) {
    setBusy(post.id);
    try {
      await api.publishArtifact(post.id, "facebook");
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const ops: FbOps | null = useMemo(
    () => (incident ? buildFbOps(incident.id) : null),
    [incident]
  );

  const place = incident
    ? [incident.location.county, incident.location.town].filter(Boolean).join("")
    : "";
  const pageName = `${place || "災區"}災害資訊整合`;

  const approved = useMemo(() => posts.filter((p) => p.status === "approved"), [posts]);
  const pending = posts.filter((p) => p.status === "pending_review").length;
  const publishedCount = posts.filter((p) => p.publication).length;
  const readyCount = Math.max(0, approved.length - publishedCount);

  const isReplied = (i: number, m: FbMessage) => replied[i] ?? m.replied;
  const unreplied = ops ? ops.inbox.filter((m, i) => !isReplied(i, m)).length : 0;
  const usingRealConnector = posts.some((p) => p.publication && p.publication.connector !== "simulated");

  return (
    <AppShell>
      <Link
        href={`/incidents/${id}`}
        className="text-sm text-stone-400 transition hover:text-stone-700"
      >
        ← 事件詳情
      </Link>

      {/* ── page identity ── */}
      <section className="db-card mt-3 overflow-hidden">
        <div
          className="h-24 w-full"
          style={{ background: `linear-gradient(120deg, ${ACCENT}, #1e3f73)` }}
        />
        <div className="px-6 pb-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex gap-4">
              <span
                className="-mt-10 grid h-20 w-20 shrink-0 place-items-center rounded-2xl border-4 border-[var(--card)] text-3xl font-bold text-white shadow-sm"
                style={{ background: ACCENT }}
              >
                f
              </span>
              <div className="pt-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="font-display text-xl font-semibold leading-tight text-stone-900">
                    {pageName}
                  </h1>
                  <span
                    className="grid h-[18px] w-[18px] place-items-center rounded-full text-[11px] font-bold text-white"
                    style={{ background: ACCENT }}
                    title="已驗證粉專（示範）"
                  >
                    ✓
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-stone-400">
                  公共與政府服務 · {ops ? nf(ops.followers) : "—"} 位追蹤者 · 模擬管理後台
                </p>
              </div>
            </div>

            {/* view switch */}
            <div className="pt-2.5 inline-flex rounded-lg border border-stone-200 bg-white p-1 text-sm">
              {(
                [
                  ["manage", "貼文管理"],
                  ["inbox", "收件匣"],
                  ["preview", "粉專預覽"],
                ] as const
              ).map(([v, label]) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setView(v)}
                  className="relative rounded-md px-4 py-1.5 font-medium transition"
                  style={view === v ? { background: "#1b1a17", color: "#f4f1ec" } : { color: "#8a8275" }}
                >
                  {label}
                  {v === "inbox" && unreplied > 0 ? (
                    <span
                      className="absolute -right-1 -top-1 grid h-4 min-w-[16px] place-items-center rounded-full px-1 text-[10px] font-bold text-white"
                      style={{ background: "#c2452d" }}
                    >
                      {unreplied}
                    </span>
                  ) : null}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* KPI band */}
        <div className="mt-2 grid grid-cols-3 divide-x border-t sm:grid-cols-6" style={{ borderColor: "var(--line)" }}>
          <Kpi label="追蹤者" value={ops ? nf(ops.followers) : "—"} demo />
          <Kpi label="本週新增" value={ops ? `+${ops.followerGrowth.toLocaleString()}` : "—"} accent={OK} demo />
          <Kpi label="近 7 日觸及" value={ops ? nf(ops.reach7d.reduce((s, v) => s + v, 0)) : "—"} demo />
          <Kpi label="互動率" value={ops ? `${ops.engagementRate}%` : "—"} demo />
          <Kpi label="訊息回應率" value={ops ? `${ops.responseRate}%` : "—"} demo />
          <Kpi label="平均回應時間" value={ops ? ops.responseTime : "—"} demo />
        </div>
      </section>

      {error ? (
        <p className="mt-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700 ring-1 ring-inset ring-rose-100">
          {error}
        </p>
      ) : null}

      {loading ? (
        <div className="db-card mt-4 h-40 animate-pulse bg-stone-100/60" />
      ) : posts.length === 0 ? (
        <div className="db-card mt-4 grid place-items-center p-12 text-center">
          <p className="text-stone-700">此事件尚未生成任何粉專內容。</p>
          <p className="mt-1.5 text-sm text-stone-400">
            到 AI 編排或事件詳情頁生成「FB 粉專貼文 / 新聞稿 / 澄清公告」後再回來管理。
          </p>
        </div>
      ) : view === "manage" ? (
        <div className="mt-5 grid gap-5 lg:grid-cols-3">
          {/* ── posts pipeline ── */}
          <div className="space-y-3 lg:col-span-2">
            <div className="flex items-baseline justify-between">
              <h2 className="db-section-title">貼文管理</h2>
              <span className="text-xs text-stone-400">
                待審核 {pending} · 可發布 {readyCount} · 已發布 {publishedCount}
              </span>
            </div>
            {posts.map((p) => (
              <PostRow
                key={p.id}
                post={p}
                busy={busy === p.id}
                onApprove={() => approve(p)}
                onPublish={() => publish(p)}
              />
            ))}
          </div>

          {/* ── rail ── */}
          <div className="space-y-5">
            {ops ? (
              <section className="db-card p-5">
                <div className="flex items-baseline justify-between">
                  <h2 className="db-section-title">洞察報告</h2>
                  <span className="text-[11px] text-stone-400">近 7 日 · 模擬</span>
                </div>
                <div className="mt-3">
                  <div className="text-xs text-stone-500">每日觸及人數</div>
                  <ReachBars data={ops.reach7d} />
                </div>
                <div className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-lg border" style={{ borderColor: "var(--line)" }}>
                  <MiniStat label="追蹤者成長" value={`+${ops.followerGrowth.toLocaleString()}`} />
                  <MiniStat label="貼文互動率" value={`${ops.engagementRate}%`} />
                  <MiniStat label="粉專瀏覽" value={nf(ops.pageViews)} />
                  <MiniStat label="貼文互動數" value={nf(ops.postEngagements)} />
                </div>
                <p className="mt-3 text-[11.5px] leading-relaxed text-stone-400">
                  災後觸及大幅上升，民眾正在找資訊。危急資訊建議置頂並固定更新時間。
                </p>
              </section>
            ) : null}

            {ops ? (
              <section className="db-card p-5">
                <h2 className="db-section-title">發文建議</h2>
                <ul className="mt-3 space-y-3">
                  {ops.suggestions.map((s, i) => (
                    <li key={i} className="flex items-start gap-2.5">
                      <span
                        className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full text-[11px] font-bold text-white"
                        style={{ background: ACCENT }}
                      >
                        {i + 1}
                      </span>
                      <div className="text-[12.5px] leading-snug">
                        <div className="font-medium text-stone-800">{s.title}</div>
                        <div className="text-[11.5px] text-stone-400">{s.why}</div>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {ops ? (
              <section className="db-card p-5">
                <div className="flex items-baseline justify-between">
                  <h2 className="db-section-title">待回覆訊息</h2>
                  <button
                    type="button"
                    onClick={() => setView("inbox")}
                    className="text-xs font-medium transition hover:underline"
                    style={{ color: ACCENT }}
                  >
                    開啟收件匣 →
                  </button>
                </div>
                <ul className="mt-3 space-y-2.5">
                  {ops.inbox
                    .map((m, i) => [m, i] as const)
                    .filter(([m, i]) => !isReplied(i, m))
                    .slice(0, 3)
                    .map(([m, i]) => (
                      <li key={i} className="flex items-start gap-2 text-[12.5px]">
                        <span
                          className="mt-0.5 shrink-0 rounded px-1.5 py-px text-[10.5px] font-semibold"
                          style={
                            m.urgent
                              ? { background: "#f6e3dd", color: "#8a4a3a" }
                              : { background: "#efeae0", color: "#5b554a" }
                          }
                        >
                          {m.urgent ? "優先" : m.kind === "comment" ? "留言" : "私訊"}
                        </span>
                        <span className="line-clamp-2 leading-snug text-stone-600">{m.text}</span>
                      </li>
                    ))}
                  {unreplied === 0 ? (
                    <li className="text-xs text-stone-400">所有訊息皆已回覆 ✓</li>
                  ) : null}
                </ul>
              </section>
            ) : null}

            <section className="db-card p-5">
              <h2 className="db-section-title">通路連接狀態</h2>
              <div className="mt-3 flex items-center gap-2 text-sm">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ background: usingRealConnector ? OK : WARN }}
                />
                <span className="text-stone-700">
                  {usingRealConnector ? "已綁定真實 Facebook 粉專" : "模擬連接器（未綁定真實粉專）"}
                </span>
              </div>
              <p className="mt-2 text-[11.5px] leading-relaxed text-stone-400">
                {usingRealConnector
                  ? "發布動作會透過 Graph API 對真實粉專發文。"
                  : "發布動作會被完整記錄但不實際對外。設定 FB_PAGE_ID / FB_PAGE_ACCESS_TOKEN 後自動改走真實 API，一律僅發布審核通過內容。"}
              </p>
            </section>
          </div>
        </div>
      ) : view === "inbox" ? (
        <InboxView ops={ops} isReplied={isReplied} onToggle={(i, cur) => setReplied((s) => ({ ...s, [i]: !cur }))} />
      ) : (
        <FbFeed pageName={pageName} posts={approved} followers={ops?.followers ?? 0} />
      )}
    </AppShell>
  );
}

/* ── presentational helpers ──────────────────────────────── */

function Kpi({
  label, value, accent, demo,
}: {
  label: string; value: string; accent?: string; demo?: boolean;
}) {
  return (
    <div className="px-4 py-3.5">
      <div className="font-display text-xl font-semibold tabular-nums" style={{ color: accent || "#1b1a17" }}>
        {value}
      </div>
      <div className="mt-0.5 text-[11px] text-stone-400">
        {label}
        {demo ? <span className="ml-1 text-stone-300">*</span> : null}
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white px-3 py-2.5 text-center">
      <div className="text-sm font-semibold tabular-nums text-stone-900">{value}</div>
      <div className="text-[10.5px] text-stone-400">{label}</div>
    </div>
  );
}

function ReachBars({ data }: { data: number[] }) {
  const max = Math.max(1, ...data);
  const labels = ["六天前", "", "", "", "", "昨天", "今天"];
  return (
    <div className="mt-2 flex h-24 items-end gap-1.5">
      {data.map((v, i) => (
        <div key={i} className="flex flex-1 flex-col items-center gap-1">
          <div
            className="w-full rounded-t"
            style={{
              height: `${(v / max) * 100}%`,
              minHeight: 3,
              background: i === data.length - 1 ? ACCENT : "#c6d2e6",
            }}
            title={v.toLocaleString()}
          />
          <span className="h-3 text-[9.5px] text-stone-400">{labels[i]}</span>
        </div>
      ))}
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
      ✓ 已發布 · {fmtTime(pub.created_at)}
      {pub.url ? (
        <a href={pub.url} target="_blank" rel="noreferrer" className="underline" style={{ color: ACCENT }}>
          查看貼文 ↗
        </a>
      ) : pub.external_ref ? (
        <span>· ref {pub.external_ref}</span>
      ) : null}
    </span>
  );
}

function PostRow({
  post,
  busy,
  onApprove,
  onPublish,
}: {
  post: Post;
  busy: boolean;
  onApprove: () => void;
  onPublish: () => void;
}) {
  const [open, setOpen] = useState(false);
  const c = post.content;
  const title = headline(c, TYPE_LABEL[post.artifact_type] || post.artifact_type);
  const body = bodyText(c);
  const hashtags: string[] = Array.isArray(c.hashtags) ? c.hashtags : [];
  const metrics = post.publication ? fbPostMetrics(post.id) : null;

  const statusPill =
    post.publication
      ? { t: "已發布", fg: "#4a6139", bg: "#e8efdd" }
      : post.status === "approved"
      ? { t: "可發布", fg: "#2f5fa8", bg: "#e7eef9" }
      : post.status === "rejected"
      ? { t: "已退回", fg: "#8a4a3a", bg: "#f6e3dd" }
      : { t: "待審核", fg: "#8a6d3b", bg: "#f5edda" };

  const clipped = body.length > 150 && !open;

  return (
    <article className="db-card p-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="db-chip" style={{ background: "#eef2f9", color: ACCENT }}>
          {TYPE_LABEL[post.artifact_type] || post.artifact_type}
        </span>
        <span
          className="rounded-full px-2 py-0.5 text-[11px] font-medium"
          style={{ background: statusPill.bg, color: statusPill.fg }}
        >
          {statusPill.t}
        </span>
        <span className="ml-auto flex items-center gap-1.5">
          {post.status === "pending_review" ? (
            <button type="button" onClick={onApprove} disabled={busy} className="db-btn db-btn-emerald !px-3 !py-1 text-xs">
              {busy ? "處理中…" : "審核通過"}
            </button>
          ) : null}
          {post.status === "approved" && !post.publication ? (
            <button
              type="button"
              onClick={onPublish}
              disabled={busy}
              className="db-btn !px-3 !py-1 text-xs text-white"
              style={{ background: ACCENT }}
            >
              {busy ? "發布中…" : "發布到粉專"}
            </button>
          ) : null}
        </span>
      </div>

      <h3 className="mt-2.5 font-display text-base font-semibold text-stone-900">{title}</h3>
      {body ? (
        <>
          <p className={`mt-1.5 whitespace-pre-line text-sm leading-relaxed text-stone-600 ${clipped ? "line-clamp-3" : ""}`}>
            {body}
          </p>
          {body.length > 150 ? (
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="mt-1 text-xs font-medium text-stone-400 transition hover:text-stone-700"
            >
              {open ? "收合 ▲" : "顯示更多 ▼"}
            </button>
          ) : null}
        </>
      ) : null}

      {hashtags.length ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {hashtags.map((h) => (
            <span key={h} className="text-xs font-medium" style={{ color: ACCENT }}>
              {h}
            </span>
          ))}
        </div>
      ) : null}

      <div className="mt-3.5 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-stone-100 pt-3">
        {metrics ? (
          <>
            <Metric label="觸及" value={nf(metrics.reach)} />
            <Metric label="心情" value={nf(metrics.likes)} />
            <Metric label="留言" value={nf(metrics.comments)} />
            <Metric label="分享" value={nf(metrics.shares)} />
            <span className="text-[10.5px] text-stone-300">成效為示範模擬</span>
          </>
        ) : post.status === "pending_review" ? (
          <span className="text-xs text-stone-400">需審核通過後才能發布</span>
        ) : !post.publication ? (
          <span className="text-xs text-stone-400">已通過審核，尚未對外發布</span>
        ) : null}
        {post.publication ? <span className="ml-auto"><PublishedTag pub={post.publication} /></span> : null}
      </div>

      {post.publication?.detail ? (
        <p className="mt-2 text-[11px] leading-snug text-stone-400">{post.publication.detail}</p>
      ) : null}
    </article>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <span className="text-xs text-stone-500">
      {label} <b className="tabular-nums text-stone-800">{value}</b>
    </span>
  );
}

function InboxView({
  ops,
  isReplied,
  onToggle,
}: {
  ops: FbOps | null;
  isReplied: (i: number, m: FbMessage) => boolean;
  onToggle: (i: number, current: boolean) => void;
}) {
  const [filter, setFilter] = useState<"all" | "open" | "done">("open");
  if (!ops) return null;
  const rows = ops.inbox
    .map((m, i) => ({ m, i, done: isReplied(i, m) }))
    .filter((r) => (filter === "all" ? true : filter === "open" ? !r.done : r.done))
    .sort((a, b) => Number(b.m.urgent ?? false) - Number(a.m.urgent ?? false));

  return (
    <div className="mt-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="db-section-title">收件匣</h2>
          <p className="mt-0.5 text-xs text-stone-400">
            留言與私訊統一處理；災害期間民眾的提問就是需求訊號（示範模擬資料）。
          </p>
        </div>
        <div className="inline-flex rounded-lg border border-stone-200 bg-white p-0.5 text-xs">
          {(
            [["open", "待回覆"], ["done", "已回覆"], ["all", "全部"]] as const
          ).map(([v, label]) => (
            <button
              key={v}
              type="button"
              onClick={() => setFilter(v)}
              className="rounded-md px-3 py-1 font-medium transition"
              style={filter === v ? { background: "#1b1a17", color: "#f4f1ec" } : { color: "#8a8275" }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-3 divide-y rounded-xl border bg-[var(--card)]" style={{ borderColor: "var(--line)" }}>
        {rows.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-stone-400">
            {filter === "open" ? "太好了，沒有待回覆的訊息。" : "沒有符合的訊息。"}
          </p>
        ) : (
          rows.map(({ m, i, done }) => (
            <div key={i} className="flex items-start gap-3.5 px-5 py-4">
              <span
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm font-semibold text-white"
                style={{ background: ["#8c6d4f", "#4f6d8c", "#6d8c4f", "#8c4f6d"][i % 4] }}
              >
                {m.author.slice(0, 1)}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 text-[12px]">
                  <span className="font-semibold text-stone-800">{m.author}</span>
                  <span className="db-chip !px-1.5 !py-px !text-[10.5px]">
                    {m.kind === "comment" ? "貼文留言" : "私訊"}
                  </span>
                  {m.urgent ? (
                    <span className="rounded px-1.5 py-px text-[10.5px] font-semibold" style={{ background: "#f6e3dd", color: "#8a4a3a" }}>
                      需優先處理
                    </span>
                  ) : null}
                  <span className="text-stone-400">{fmtAgo(m.agoMin)}</span>
                </div>
                <p className="mt-1 text-[13.5px] leading-relaxed text-stone-700">{m.text}</p>
                {done && m.reply ? (
                  <div className="mt-2 rounded-lg rounded-tl-none border border-stone-200 bg-white px-3 py-2 text-[12.5px] leading-relaxed text-stone-600">
                    <span className="mr-1.5 rounded px-1.5 py-px text-[10.5px] font-semibold text-white" style={{ background: ACCENT }}>
                      粉專回覆
                    </span>
                    {m.reply}
                  </div>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => onToggle(i, done)}
                className={`db-btn shrink-0 !px-3 !py-1.5 text-xs ${done ? "db-btn-ghost" : "db-btn-emerald"}`}
              >
                {done ? "已回覆 ✓" : "標記已回覆"}
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function FbFeed({
  pageName,
  posts,
  followers,
}: {
  pageName: string;
  posts: Post[];
  followers: number;
}) {
  if (posts.length === 0) {
    return (
      <div className="db-card mt-4 grid place-items-center p-12 text-center">
        <p className="text-stone-700">尚無審核通過的貼文。</p>
        <p className="mt-1.5 text-sm text-stone-400">
          於「貼文管理」審核通過後，這裡會以粉專版面呈現，對外只看得到通過的內容。
        </p>
      </div>
    );
  }
  return (
    <div className="mt-4">
      <p className="text-center text-xs text-stone-400">
        以下為粉專對外呈現的樣子（僅顯示審核通過的貼文；互動數為示範模擬）。
      </p>

      {/* page header card */}
      <div className="mx-auto mt-3 max-w-xl overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm">
        <div className="h-20 w-full" style={{ background: `linear-gradient(120deg, ${ACCENT}, #1e3f73)` }} />
        <div className="flex items-end justify-between px-4 pb-3">
          <div className="flex items-end gap-3">
            <span
              className="-mt-6 grid h-14 w-14 place-items-center rounded-full border-4 border-white text-xl font-bold text-white"
              style={{ background: ACCENT }}
            >
              f
            </span>
            <div className="pb-0.5">
              <div className="text-[15px] font-bold text-stone-900">{pageName} <span style={{ color: ACCENT }}>✓</span></div>
              <div className="text-xs text-stone-400">{nf(followers)} 位追蹤者</div>
            </div>
          </div>
          <span className="mb-0.5 rounded-md px-3 py-1 text-xs font-semibold text-white" style={{ background: ACCENT }}>
            追蹤中 ✓
          </span>
        </div>
      </div>

      <div className="mt-4 space-y-4">
        {posts.map((p, idx) => {
          const c = p.content;
          const title = headline(c, "粉專貼文");
          const body = bodyText(c);
          const hashtags: string[] = Array.isArray(c.hashtags) ? c.hashtags : [];
          const m = fbPostMetrics(p.id);
          const when = p.publication ? fmtTime(p.publication.created_at) : "剛剛";
          return (
            <article
              key={p.id}
              className="db-reveal mx-auto max-w-xl rounded-xl border border-stone-200 bg-white shadow-sm"
              style={{ animationDelay: `${Math.min(idx * 80, 400)}ms` }}
            >
              <header className="flex items-center gap-3 p-4 pb-2.5">
                <span
                  className="grid h-10 w-10 place-items-center rounded-full text-lg font-bold text-white"
                  style={{ background: ACCENT }}
                >
                  f
                </span>
                <div>
                  <div className="text-sm font-semibold text-stone-900">
                    {pageName} <span style={{ color: ACCENT }}>✓</span>
                  </div>
                  <div className="text-xs text-stone-400">{when} · 🌐 公開</div>
                </div>
              </header>
              {title ? (
                <h3 className="px-4 pb-1 font-display text-[15px] font-semibold text-stone-900">
                  {title}
                </h3>
              ) : null}
              <p className="whitespace-pre-line px-4 pb-3 text-sm leading-relaxed text-stone-700">
                {body}
              </p>
              {hashtags.length ? (
                <p className="px-4 pb-3 text-sm" style={{ color: ACCENT }}>
                  {hashtags.join(" ")}
                </p>
              ) : null}
              <div className="flex items-center justify-between border-t border-stone-100 px-4 py-2 text-xs text-stone-500">
                <span>👍❤️ {nf(m.likes)}</span>
                <span>{nf(m.comments)} 則留言 · {nf(m.shares)} 次分享</span>
              </div>
              <div className="flex items-center justify-around border-t border-stone-100 py-1.5 text-sm text-stone-500">
                <span className="rounded px-3 py-1">讚</span>
                <span className="rounded px-3 py-1">留言</span>
                <span className="rounded px-3 py-1">分享</span>
              </div>
              {/* top comments */}
              <div className="space-y-2.5 border-t border-stone-100 px-4 py-3">
                {fbPostComments(p.id).map((cm, ci) => (
                  <div key={ci} className="flex items-start gap-2">
                    <span
                      className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-semibold text-white"
                      style={{ background: ["#8c6d4f", "#4f6d8c", "#6d8c4f", "#8c4f6d"][ci % 4] }}
                    >
                      {cm.author.slice(0, 1)}
                    </span>
                    <div className="min-w-0">
                      <div className="inline-block rounded-2xl bg-stone-100 px-3 py-1.5">
                        <span className="block text-xs font-semibold text-stone-800">{cm.author}</span>
                        <span className="text-[13px] leading-snug text-stone-700">{cm.text}</span>
                      </div>
                      <div className="mt-0.5 pl-3 text-[11px] text-stone-400">
                        {fmtAgo(cm.agoMin)} · 讚 {cm.likes}
                      </div>
                    </div>
                  </div>
                ))}
                <button type="button" className="pl-9 text-xs font-medium text-stone-400">
                  查看全部 {nf(m.comments)} 則留言
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
