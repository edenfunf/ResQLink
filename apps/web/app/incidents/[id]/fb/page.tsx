"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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

const ACCENT = "#2f5fa8";
const FB_TYPES: ArtifactType[] = ["fb_page_post", "press_release", "clarification_notice"];

const TYPE_LABEL: Record<string, string> = {
  fb_page_post: "粉專貼文",
  press_release: "新聞稿 / 懶人包",
  clarification_notice: "澄清 / 闢謠",
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

export default function FbAdminPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [incident, setIncident] = useState<IncidentDetail | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<"manage" | "preview">("manage");
  const [busy, setBusy] = useState<string | null>(null);

  // honour ?view=preview deep links without needing a Suspense boundary
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

  const place = incident
    ? [incident.location.county, incident.location.town, incident.location.river]
        .filter(Boolean)
        .join("")
    : "";
  const pageName = `${place}災害資訊整合`;

  const approved = useMemo(() => posts.filter((p) => p.status === "approved"), [posts]);
  const pending = posts.filter((p) => p.status === "pending_review").length;
  const publishedCount = posts.filter((p) => p.publication).length;

  return (
    <AppShell>
      <Link
        href={`/incidents/${id}`}
        className="text-sm text-stone-400 transition hover:text-stone-700"
      >
        ← 事件詳情
      </Link>

      {/* page identity bar */}
      <section className="db-card mt-3 overflow-hidden">
        <div
          className="h-24 w-full"
          style={{
            background: `linear-gradient(120deg, ${ACCENT}, #1e3f73)`,
          }}
        />
        <div className="px-6 pb-5">
          <div className="-mt-9 flex items-end gap-4">
            <span
              className="grid h-20 w-20 place-items-center rounded-2xl border-4 border-[var(--card)] text-3xl font-bold text-white shadow-sm"
              style={{ background: ACCENT }}
            >
              f
            </span>
            <div className="pb-1">
              <div className="flex items-center gap-2">
                <h1 className="font-display text-xl font-semibold text-stone-900">
                  {pageName}
                </h1>
                <span
                  className="rounded-full px-2 py-0.5 text-[11px] font-medium text-white"
                  style={{ background: ACCENT }}
                >
                  FB 粉專
                </span>
              </div>
              <p className="mt-0.5 text-xs text-stone-400">
                模擬管理後台 · Facebook Page · 由 災鏈 ResQLink 生成
              </p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-6 text-sm">
            <Stat label="貼文" value={posts.length} />
            <Stat label="已發布" value={publishedCount} />
            <Stat label="待審核" value={pending} />
            <Stat label="可發布" value={approved.length - publishedCount < 0 ? 0 : approved.length - publishedCount} />
          </div>
        </div>
      </section>

      {/* view switch */}
      <div className="mt-4 inline-flex rounded-lg border border-stone-200 bg-[var(--card)] p-1 text-sm">
        {(["manage", "preview"] as const).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => setView(v)}
            className="rounded-md px-4 py-1.5 font-medium transition"
            style={
              view === v
                ? { background: ACCENT, color: "#fff" }
                : { color: "#6b6457" }
            }
          >
            {v === "manage" ? "貼文管理" : "粉專預覽"}
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
      ) : posts.length === 0 ? (
        <div className="db-card mt-4 grid place-items-center p-12 text-center">
          <p className="text-stone-700">此事件尚未生成任何粉專內容。</p>
          <p className="mt-1.5 text-sm text-stone-400">
            到 AI 編排或事件詳情頁生成「FB 粉專貼文 / 新聞稿 / 澄清公告」後再回來管理。
          </p>
        </div>
      ) : view === "manage" ? (
        <div className="mt-4 space-y-3">
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
      ) : (
        <FbFeed pageName={pageName} posts={approved} />
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

function PublishedTag({ pub, verb }: { pub: PublicationItem; verb: string }) {
  const real = pub.connector !== "simulated";
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5 rounded-lg bg-[#e8efdd] px-3 py-1.5 text-xs text-[#4a6139]">
      <span
        className="rounded px-1.5 py-0.5 text-[10px] font-semibold"
        style={real ? { background: "#3a7d44", color: "#fff" } : { background: "#cdd3bc" }}
      >
        {real ? "真實" : "模擬"}
      </span>
      ✓ 已{verb}
      {pub.url ? (
        <a href={pub.url} target="_blank" rel="noreferrer" className="underline" style={{ color: "#2f5fa8" }}>
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
  const c = post.content;
  const title = headline(c, TYPE_LABEL[post.artifact_type] || post.artifact_type);
  const body = bodyText(c);
  const hashtags: string[] = Array.isArray(c.hashtags) ? c.hashtags : [];

  const statusPill =
    post.status === "approved"
      ? { t: "已通過", fg: "#4a6139", bg: "#e8efdd" }
      : post.status === "rejected"
      ? { t: "已退回", fg: "#8a4a3a", bg: "#f6e3dd" }
      : { t: "待審核", fg: "#2f5290", bg: "#e7eef9" };

  return (
    <article className="db-card db-reveal p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="db-chip" style={{ background: "#eef2f9", color: ACCENT }}>
              {TYPE_LABEL[post.artifact_type] || post.artifact_type}
            </span>
            <span
              className="rounded-full px-2 py-0.5 text-[11px] font-medium"
              style={{ background: statusPill.bg, color: statusPill.fg }}
            >
              {statusPill.t}
            </span>
          </div>
          <h3 className="mt-2 font-display text-base font-semibold text-stone-900">
            {title}
          </h3>
        </div>
      </div>

      {body ? (
        <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-stone-600">
          {body}
        </p>
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

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-stone-100 pt-3">
        {post.status === "pending_review" ? (
          <button
            type="button"
            onClick={onApprove}
            disabled={busy}
            className="db-btn db-btn-emerald text-xs"
          >
            {busy ? "處理中…" : "審核通過"}
          </button>
        ) : null}

        {post.status === "approved" && !post.publication ? (
          <button
            type="button"
            onClick={onPublish}
            disabled={busy}
            className="db-btn text-xs text-white"
            style={{ background: ACCENT }}
          >
            {busy ? "發布中…" : "發布到粉專"}
          </button>
        ) : null}

        {post.publication ? (
          <PublishedTag pub={post.publication} verb="發布" />
        ) : null}

        {post.status === "pending_review" ? (
          <span className="text-xs text-stone-400">需審核通過後才能發布</span>
        ) : null}
      </div>

      {post.publication?.detail ? (
        <p className="mt-2 text-[11px] leading-snug text-stone-400">
          {post.publication.detail}
        </p>
      ) : null}
    </article>
  );
}

function FbFeed({ pageName, posts }: { pageName: string; posts: Post[] }) {
  if (posts.length === 0) {
    return (
      <div className="db-card mt-4 grid place-items-center p-12 text-center">
        <p className="text-stone-700">尚無審核通過的貼文。</p>
        <p className="mt-1.5 text-sm text-stone-400">
          於「貼文管理」審核通過後，這裡會以粉專版面呈現——對外只看得到通過的內容。
        </p>
      </div>
    );
  }
  return (
    <div className="mt-4 space-y-4">
      <p className="text-xs text-stone-400">
        以下為粉專對外呈現的樣子（僅顯示審核通過的貼文）。正式上線時可綁定真實 Facebook 粉專。
      </p>
      {posts.map((p, idx) => {
        const c = p.content;
        const title = headline(c, "粉專貼文");
        const body = bodyText(c);
        const hashtags: string[] = Array.isArray(c.hashtags) ? c.hashtags : [];
        return (
          <article
            key={p.id}
            className="db-reveal mx-auto max-w-xl rounded-xl border border-stone-200 bg-white shadow-sm"
            style={{ animationDelay: `${Math.min(idx * 80, 400)}ms` }}
          >
            <header className="flex items-center gap-3 p-4">
              <span
                className="grid h-10 w-10 place-items-center rounded-full text-lg font-bold text-white"
                style={{ background: ACCENT }}
              >
                f
              </span>
              <div>
                <div className="text-sm font-semibold text-stone-900">{pageName}</div>
                <div className="text-xs text-stone-400">公開貼文 · 剛剛</div>
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
            <div className="flex items-center justify-around border-t border-stone-100 py-1.5 text-sm text-stone-500">
              <span className="rounded px-3 py-1">讚</span>
              <span className="rounded px-3 py-1">留言</span>
              <span className="rounded px-3 py-1">分享</span>
            </div>
          </article>
        );
      })}
    </div>
  );
}
