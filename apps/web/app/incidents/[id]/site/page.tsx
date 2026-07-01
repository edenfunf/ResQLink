"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import JsonBlock from "@/components/JsonBlock";
import { api, API_BASE } from "@/lib/api";
import type {
  ArtifactType,
  IncidentDetail,
  ReviewTaskItem,
} from "@/lib/types";

const ACCENT = "#8c3b2e";

// The building blocks that make up the generated rescue website (== the
// rescue_site deliverable members on the backend).
const SITE_TYPES: ArtifactType[] = [
  "microsite_config",
  "public_notice_draft",
  "damage_report_form",
  "map_bundle",
  "evacuation_guide",
  "faq",
  "sos_form",
  "medical_need_form",
  "vulnerable_care_list",
  "shelter_map",
  "hazard_zone_layer",
];

const TYPE_LABEL: Record<string, string> = {
  microsite_config: "網站入口設定",
  public_notice_draft: "公開公告",
  damage_report_form: "災情回報表單",
  map_bundle: "災情地圖組合",
  evacuation_guide: "避難與撤離指引",
  faq: "常見問答",
  sos_form: "緊急求援登記",
  medical_need_form: "醫療需求登記",
  vulnerable_care_list: "弱勢關懷名單",
  shelter_map: "避難收容所地圖",
  hazard_zone_layer: "危險區 / 道路封閉圖層",
};

type Block = {
  id: string;
  artifact_type: string;
  title?: string | null;
  status: string;
  risk_level: string;
  content: Record<string, any>;
  review: ReviewTaskItem | null;
};

/** A short, human-readable line summarising an artifact's content. */
function summarize(content: Record<string, any>): string {
  if (!content) return "";
  if (Array.isArray(content.fields))
    return `表單欄位 ${content.fields.length} 項`;
  if (Array.isArray(content.items)) return `項目 ${content.items.length} 則`;
  if (Array.isArray(content.layers))
    return `地圖圖層 ${content.layers.length} 個`;
  const body =
    content.body ||
    content.summary ||
    content.intro ||
    content.description ||
    (Array.isArray(content.body_paragraphs)
      ? content.body_paragraphs.join(" ")
      : "");
  if (typeof body === "string" && body) return body;
  return "";
}

function heading(b: Block): string {
  const c = b.content || {};
  return (
    b.title ||
    c.title ||
    c.headline ||
    c.site_title ||
    c.name ||
    TYPE_LABEL[b.artifact_type] ||
    b.artifact_type
  );
}

export default function SiteAdminPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [incident, setIncident] = useState<IncidentDetail | null>(null);
  const [blocks, setBlocks] = useState<Block[]>([]);
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
      const [inc, arts, revs] = await Promise.all([
        api.getIncident(id),
        api.listArtifacts({ incident_id: id, limit: 100 }),
        api.listReviews({ incident_id: id, limit: 100 }),
      ]);
      const site = arts.items.filter((a) => SITE_TYPES.includes(a.artifact_type));
      const detailed = await Promise.all(
        site.map(async (a) => {
          const d = await api.getArtifact(a.id);
          return {
            id: a.id,
            artifact_type: a.artifact_type,
            title: a.title,
            status: a.status,
            risk_level: a.risk_level,
            content: d.content,
            review:
              revs.items.find(
                (r) => r.artifact_id === a.id && r.status === "pending"
              ) ?? null,
          } as Block;
        })
      );
      // keep a stable, meaningful order (site config first, then the rest)
      detailed.sort(
        (x, y) =>
          SITE_TYPES.indexOf(x.artifact_type as ArtifactType) -
          SITE_TYPES.indexOf(y.artifact_type as ArtifactType)
      );
      setIncident(inc);
      setBlocks(detailed);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function decide(b: Block, action: "approve" | "reject") {
    if (!b.review) return;
    setBusy(b.id);
    try {
      if (action === "approve") await api.approveReview(b.review.id);
      else await api.rejectReview(b.review.id);
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
  const siteName = `${place}救災資訊網站`;

  const approved = useMemo(
    () => blocks.filter((b) => b.status === "approved"),
    [blocks]
  );
  const pending = blocks.filter((b) => b.status === "pending_review").length;

  const previewPath = incident ? `/preview/${encodeURIComponent(incident.slug)}` : "";

  return (
    <AppShell>
      <Link
        href={`/incidents/${id}`}
        className="text-sm text-stone-400 transition hover:text-stone-700"
      >
        ← 事件詳情
      </Link>

      {/* site identity bar */}
      <section className="db-card mt-3 overflow-hidden">
        <div
          className="h-24 w-full"
          style={{ background: `linear-gradient(120deg, ${ACCENT}, #5a2317)` }}
        />
        <div className="px-6 pb-5">
          <div className="-mt-9 flex items-end gap-4">
            <span
              className="grid h-20 w-20 place-items-center rounded-2xl border-4 border-[var(--card)] text-white shadow-sm"
              style={{ background: ACCENT }}
            >
              <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="9" />
                <path d="M3 12h18M12 3c2.5 2.6 2.5 15.4 0 18M12 3c-2.5 2.6-2.5 15.4 0 18" />
              </svg>
            </span>
            <div className="pb-1">
              <div className="flex items-center gap-2">
                <h1 className="font-display text-xl font-semibold text-stone-900">
                  {siteName}
                </h1>
                <span
                  className="rounded-full px-2 py-0.5 text-[11px] font-medium text-white"
                  style={{ background: ACCENT }}
                >
                  救災資訊網站
                </span>
              </div>
              <p className="mt-0.5 text-xs text-stone-400">
                模擬管理後台 · 救災資訊入口 · 由 災鏈 ResQLink 生成
              </p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-6 text-sm">
            <Stat label="網站元件" value={blocks.length} />
            <Stat label="已上線" value={approved.length} />
            <Stat label="待審核" value={pending} />
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
            style={view === v ? { background: ACCENT, color: "#fff" } : { color: "#6b6457" }}
          >
            {v === "manage" ? "內容管理" : "網站預覽"}
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
      ) : blocks.length === 0 ? (
        <div className="db-card mt-4 grid place-items-center p-12 text-center">
          <p className="text-stone-700">此事件尚未生成任何救災網站元件。</p>
          <p className="mt-1.5 text-sm text-stone-400">
            到 AI 編排或事件詳情頁生成「救災資訊網站」相關元件後再回來管理。
          </p>
        </div>
      ) : view === "manage" ? (
        <>
          <p className="mt-4 text-xs leading-relaxed text-stone-400">
            以下是這個救災網站的組成元件。審核通過的內容才會出現在對外網站——審核就是網站的上線閘門。
          </p>
          <div className="mt-3 space-y-3">
            {blocks.map((b) => (
              <BlockRow
                key={b.id}
                b={b}
                busy={busy === b.id}
                onApprove={() => decide(b, "approve")}
                onReject={() => decide(b, "reject")}
              />
            ))}
          </div>
        </>
      ) : (
        <SitePreview previewPath={previewPath} apiSlug={incident?.slug ?? ""} />
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

function BlockRow({
  b,
  busy,
  onApprove,
  onReject,
}: {
  b: Block;
  busy: boolean;
  onApprove: () => void;
  onReject: () => void;
}) {
  const [open, setOpen] = useState(false);
  const summary = summarize(b.content);
  const pill =
    b.status === "approved"
      ? { t: "已上線", fg: "#4a6139", bg: "#e8efdd" }
      : b.status === "rejected"
      ? { t: "已退回", fg: "#8a4a3a", bg: "#f6e3dd" }
      : { t: "待審核", fg: "#2f5290", bg: "#e7eef9" };

  return (
    <article className="db-card db-reveal p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="db-chip" style={{ background: "#f7ece7", color: ACCENT }}>
              {TYPE_LABEL[b.artifact_type] || b.artifact_type}
            </span>
            <span
              className="rounded-full px-2 py-0.5 text-[11px] font-medium"
              style={{ background: pill.bg, color: pill.fg }}
            >
              {pill.t}
            </span>
          </div>
          <h3 className="mt-2 font-display text-base font-semibold text-stone-900">
            {heading(b)}
          </h3>
          {summary ? (
            <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-stone-600">
              {summary}
            </p>
          ) : null}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-stone-100 pt-3">
        {b.status === "pending_review" ? (
          <>
            <button
              type="button"
              onClick={onApprove}
              disabled={busy}
              className="db-btn db-btn-emerald text-xs"
            >
              {busy ? "處理中…" : "審核通過（上線）"}
            </button>
            <button
              type="button"
              onClick={onReject}
              disabled={busy}
              className="db-btn db-btn-ghost text-xs"
            >
              退回
            </button>
          </>
        ) : b.status === "approved" ? (
          <span className="text-xs text-[#4a6139]">✓ 已對外顯示於救災網站</span>
        ) : (
          <span className="text-xs text-stone-400">已退回，不會對外顯示</span>
        )}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="ml-auto text-xs font-medium text-stone-500 transition hover:text-[#8c3b2e]"
        >
          {open ? "隱藏內容 ▲" : "查看內容 ▼"}
        </button>
      </div>

      {open ? (
        <div className="mt-2">
          <JsonBlock data={b.content} label="content" collapsed={false} />
        </div>
      ) : null}
    </article>
  );
}

function SitePreview({ previewPath, apiSlug }: { previewPath: string; apiSlug: string }) {
  if (!previewPath) {
    return (
      <div className="db-card mt-4 grid place-items-center p-12 text-center text-sm text-stone-500">
        尚無可預覽的網站。
      </div>
    );
  }
  return (
    <div className="mt-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-stone-400">
          以下為對外網站的實際樣子（僅顯示審核通過的內容）。
        </p>
        <a
          href={previewPath}
          target="_blank"
          rel="noreferrer"
          className="db-btn text-xs text-white"
          style={{ background: ACCENT }}
        >
          在新分頁開啟 ↗
        </a>
      </div>
      <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white">
        <iframe
          src={previewPath}
          title="救災網站預覽"
          className="h-[70vh] w-full"
        />
      </div>
      {apiSlug ? (
        <p className="mt-2 font-mono text-[11px] text-stone-400">
          公開網址 · {previewPath} · API {API_BASE}/v1/public/preview/{apiSlug}
        </p>
      ) : null}
    </div>
  );
}
