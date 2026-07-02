"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import JsonBlock from "@/components/JsonBlock";
import { api, API_BASE } from "@/lib/api";
import { useViewParam } from "@/lib/useViewParam";
import { buildSiteOps } from "@/lib/demoContent";
import type { SiteOps } from "@/lib/demoContent";
import type {
  ArtifactType,
  IncidentDetail,
  IncidentSummary,
  PublicationItem,
  ReviewTaskItem,
  TimelineItem,
} from "@/lib/types";

const ACCENT = "#8c3b2e";
const OK = "#566246";
const WARN = "#b07d3c";

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
  "multilingual_notice",
  "accessibility_notice",
  "school_closure_notice",
  "missing_person_board",
  "pet_rescue_form",
  "psych_support_booking",
  "medical_priority_roster",
  "evacuation_route_plan",
  "flood_depth_layer",
  "resource_poi_map",
  "official_source_links",
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
  multilingual_notice: "多語公告翻譯",
  accessibility_notice: "易讀版公告",
  school_closure_notice: "停班停課公告",
  missing_person_board: "失聯協尋看板",
  pet_rescue_form: "寵物救援登記",
  psych_support_booking: "心理支持預約",
  medical_priority_roster: "維生醫療優先名冊",
  evacuation_route_plan: "避難路線規劃",
  flood_depth_layer: "淹水深度圖層",
  resource_poi_map: "救災資源點位圖",
  official_source_links: "官方資訊源連結集",
};

const RISK_LABEL: Record<string, { t: string; c: string }> = {
  low: { t: "低風險", c: "#566246" },
  medium: { t: "中風險", c: "#b07d3c" },
  high: { t: "高風險", c: "#8a4a3a" },
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

/** Collapse consecutive timeline entries with the same label（生成 x11…）. */
function groupTimeline(items: TimelineItem[]): (TimelineItem & { count: number })[] {
  const out: (TimelineItem & { count: number })[] = [];
  for (const it of items) {
    const last = out[out.length - 1];
    if (last && last.label === it.label) {
      last.count += 1;
      last.at = it.at; // keep the latest timestamp
    } else {
      out.push({ ...it, count: 1 });
    }
  }
  return out;
}

export default function SiteAdminPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [incident, setIncident] = useState<IncidentDetail | null>(null);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [summary, setSummary] = useState<IncidentSummary | null>(null);
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [publications, setPublications] = useState<PublicationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useViewParam<"manage" | "preview">("manage", ["manage", "preview"]);
  const [busy, setBusy] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

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

      const [sm, tl, pub] = await Promise.allSettled([
        api.getIncidentSummary(id),
        api.getTimeline(id),
        api.listPublications(id),
      ]);
      if (sm.status === "fulfilled") setSummary(sm.value);
      if (tl.status === "fulfilled") setTimeline(tl.value.items);
      if (pub.status === "fulfilled") setPublications(pub.value.items);
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

  const ops: SiteOps | null = useMemo(
    () => (incident ? buildSiteOps(incident.id) : null),
    [incident]
  );

  const place = incident
    ? [incident.location.county, incident.location.town]
        .filter(Boolean)
        .join("")
    : "";
  const siteName = `${place || "災區"}救災資訊網站`;

  const approved = useMemo(
    () => blocks.filter((b) => b.status === "approved"),
    [blocks]
  );
  const pending = blocks.filter((b) => b.status === "pending_review").length;
  const isLive = approved.length > 0;

  const previewPath = incident ? `/preview/${encodeURIComponent(incident.slug)}` : "";
  const publicUrl =
    typeof window !== "undefined" && previewPath
      ? `${window.location.origin}${previewPath}`
      : previewPath;

  function copyUrl() {
    if (!publicUrl) return;
    navigator.clipboard?.writeText(publicUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    });
  }

  const events = useMemo(() => groupTimeline(timeline).reverse().slice(0, 8), [timeline]);

  // launch checklist derived from real block states + report data
  const approvedTypes = new Set(approved.map((b) => b.artifact_type));
  const checklist: { label: string; ok: boolean; hint: string }[] = [
    { label: "網站入口設定已上線", ok: approvedTypes.has("microsite_config"), hint: "決定網站標題與版面" },
    { label: "公開公告已上線", ok: approvedTypes.has("public_notice_draft"), hint: "民眾看到的第一則說明" },
    { label: "災情地圖已上線", ok: approvedTypes.has("map_bundle"), hint: "含通報點位與警戒範圍" },
    { label: "災情回報表單已上線", ok: approvedTypes.has("damage_report_form"), hint: "民眾通報的入口" },
    { label: "避難指引或問答已上線", ok: approvedTypes.has("evacuation_guide") || approvedTypes.has("faq"), hint: "自救與撤離資訊" },
    { label: "已有民眾通報資料", ok: (summary?.reports.total ?? 0) > 0, hint: "地圖與動態才有內容" },
  ];
  const checkDone = checklist.filter((c) => c.ok).length;

  return (
    <AppShell>
      <Link
        href={`/incidents/${id}`}
        className="text-sm text-stone-400 transition hover:text-stone-700"
      >
        ← 事件詳情
      </Link>

      {/* ── site identity + ops header ── */}
      <section className="db-card mt-3 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b px-6 py-4" style={{ borderColor: "var(--line)" }}>
          <div className="flex min-w-0 items-center gap-3.5">
            <span
              className="grid h-12 w-12 shrink-0 place-items-center rounded-xl text-white"
              style={{ background: ACCENT }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="9" />
                <path d="M3 12h18M12 3c2.5 2.6 2.5 15.4 0 18M12 3c-2.5 2.6-2.5 15.4 0 18" />
              </svg>
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-display truncate text-xl font-semibold text-stone-900">
                  {siteName}
                </h1>
                {isLive ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold text-white" style={{ background: OK }}>
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="absolute h-full w-full animate-ping rounded-full bg-white opacity-70" />
                      <span className="relative h-1.5 w-1.5 rounded-full bg-white" />
                    </span>
                    上線中
                  </span>
                ) : (
                  <span className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold text-white" style={{ background: WARN }}>
                    建置中
                  </span>
                )}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-stone-400">
                <span className="max-w-[420px] truncate font-mono">{publicUrl || "—"}</span>
                <button
                  type="button"
                  onClick={copyUrl}
                  className="rounded border border-stone-200 px-1.5 py-0.5 text-[11px] text-stone-500 transition hover:border-stone-300 hover:text-stone-800"
                >
                  {copied ? "已複製 ✓" : "複製"}
                </button>
                {previewPath ? (
                  <a
                    href={previewPath}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded border border-stone-200 px-1.5 py-0.5 text-[11px] text-stone-500 transition hover:border-stone-300 hover:text-stone-800"
                  >
                    開啟 ↗
                  </a>
                ) : null}
              </div>
            </div>
          </div>

          {/* view switch */}
          <div className="inline-flex rounded-lg border border-stone-200 bg-white p-1 text-sm">
            {(["manage", "preview"] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                className="rounded-md px-4 py-1.5 font-medium transition"
                style={view === v ? { background: "#1b1a17", color: "#f4f1ec" } : { color: "#8a8275" }}
              >
                {v === "manage" ? "內容與營運" : "網站預覽"}
              </button>
            ))}
          </div>
        </div>

        {/* KPI band */}
        <div className="grid grid-cols-3 divide-x sm:grid-cols-6" style={{ borderColor: "var(--line)" }}>
          <Kpi label="今日瀏覽" value={ops?.todayVisits ?? 0} demo />
          <Kpi label="累計瀏覽" value={ops?.totalVisits ?? 0} demo />
          <Kpi label="上線元件" value={approved.length} suffix={` / ${blocks.length}`} />
          <Kpi label="待審核" value={pending} accent={pending > 0 ? WARN : undefined} />
          <Kpi label="民眾通報" value={summary?.reports.total ?? 0} />
          <Kpi label="危急未結" value={summary?.reports.critical_open ?? 0} accent={(summary?.reports.critical_open ?? 0) > 0 ? "#8a4a3a" : undefined} />
        </div>
      </section>

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
        <div className="mt-5 grid gap-5 lg:grid-cols-3">
          {/* ── main column ── */}
          <div className="space-y-5 lg:col-span-2">
            {/* content pipeline */}
            <section className="db-card">
              <header className="flex flex-wrap items-center justify-between gap-2 px-5 pt-4">
                <div>
                  <h2 className="db-section-title">內容上線管線</h2>
                  <p className="mt-0.5 text-xs text-stone-400">
                    審核通過的內容才會出現在對外網站；審核就是網站的上線閘門。
                  </p>
                </div>
                <span className="text-xs text-stone-500">
                  已上線 <b className="text-stone-800">{approved.length}</b> / {blocks.length}
                </span>
              </header>
              <div className="mx-5 mt-3 h-1.5 overflow-hidden rounded-full bg-stone-200/70">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${(approved.length / Math.max(1, blocks.length)) * 100}%`, background: OK }}
                />
              </div>
              <div className="mt-4 divide-y" style={{ borderColor: "var(--line)" }}>
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
            </section>

            {/* traffic */}
            {ops ? (
              <section className="db-card p-5">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="db-section-title">流量與觸及</h2>
                  <span className="text-[11px] text-stone-400">近 24 小時 · 示範模擬數據</span>
                </div>
                <div className="mt-4 grid gap-5 md:grid-cols-2">
                  <div>
                    <Sparkline data={ops.hourly} />
                    <div className="mt-3 grid grid-cols-3 gap-px overflow-hidden rounded-lg border" style={{ borderColor: "var(--line)" }}>
                      <MiniStat label="今日瀏覽" value={ops.todayVisits.toLocaleString()} />
                      <MiniStat label="平均停留" value={ops.avgStay} />
                      <MiniStat label="連結分享" value={ops.shareCount.toLocaleString()} />
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-xs font-semibold text-stone-500">流量來源</h3>
                      <div className="mt-2 space-y-1.5">
                        {ops.sources.map((s) => (
                          <div key={s.name} className="flex items-center gap-2 text-xs">
                            <span className="w-28 shrink-0 text-stone-500">{s.name}</span>
                            <div className="h-2 flex-1 overflow-hidden rounded-full bg-stone-200/70">
                              <div className="h-full rounded-full" style={{ width: `${s.pct}%`, background: ACCENT }} />
                            </div>
                            <span className="w-9 text-right tabular-nums text-stone-600">{s.pct}%</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <h3 className="text-xs font-semibold text-stone-500">熱門區塊</h3>
                      <ul className="mt-2 space-y-1">
                        {ops.sections.map((s, i) => (
                          <li key={s.name} className="flex items-center justify-between text-xs">
                            <span className="text-stone-600">
                              <span className="mr-1.5 inline-block w-4 text-right font-semibold text-stone-400">{i + 1}</span>
                              {s.name}
                            </span>
                            <span className="tabular-nums text-stone-500">{s.views.toLocaleString()} 次</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              </section>
            ) : null}
          </div>

          {/* ── rail ── */}
          <div className="space-y-5">
            {/* launch checklist */}
            <section className="db-card p-5">
              <div className="flex items-baseline justify-between">
                <h2 className="db-section-title">上線檢查清單</h2>
                <span className="text-xs tabular-nums text-stone-400">{checkDone}/{checklist.length}</span>
              </div>
              <ul className="mt-3 space-y-2.5">
                {checklist.map((c) => (
                  <li key={c.label} className="flex items-start gap-2.5">
                    <span
                      className="mt-0.5 grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full text-[11px] font-bold text-white"
                      style={{ background: c.ok ? OK : "#c9c1b2" }}
                    >
                      {c.ok ? "✓" : ""}
                    </span>
                    <div className="text-[12.5px] leading-snug">
                      <span className={c.ok ? "text-stone-700" : "font-medium text-stone-900"}>{c.label}</span>
                      <div className="text-[11.5px] text-stone-400">{c.hint}</div>
                    </div>
                  </li>
                ))}
              </ul>
            </section>

            {/* outbound channels */}
            <section className="db-card p-5">
              <h2 className="db-section-title">對外通路</h2>
              {publications.length ? (
                <ul className="mt-3 space-y-2">
                  {publications.slice(0, 5).map((p) => (
                    <li key={p.id} className="flex items-center justify-between gap-2 text-xs">
                      <span className="flex items-center gap-1.5 text-stone-700">
                        <span className="db-chip">{p.channel === "facebook" ? "FB 粉專" : p.channel === "line" ? "LINE 推播" : p.channel}</span>
                        <span className="text-stone-400">{fmtTime(p.created_at)}</span>
                      </span>
                      <span className="font-medium" style={{ color: p.status === "published" || p.status === "sent" ? OK : WARN }}>
                        {p.status === "published" || p.status === "sent" ? "已發布" : p.status}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-xs leading-relaxed text-stone-400">
                  尚未發布到外部通路。審核通過公告後，可從 FB／LINE 後台一鍵發布。
                </p>
              )}
              <div className="mt-3.5 flex gap-2">
                <Link href={`/incidents/${id}/fb`} className="db-btn db-btn-ghost flex-1 text-xs">
                  FB 粉專後台
                </Link>
                <Link href={`/incidents/${id}/line`} className="db-btn db-btn-ghost flex-1 text-xs">
                  LINE 官帳後台
                </Link>
              </div>
            </section>

            {/* audit log */}
            <section className="db-card p-5">
              <h2 className="db-section-title">操作紀錄</h2>
              <ol className="relative mt-3 space-y-3.5 before:absolute before:left-[5px] before:top-1 before:h-[calc(100%-10px)] before:w-px before:bg-stone-200">
                {events.length === 0 ? (
                  <li className="text-xs text-stone-400">尚無紀錄。</li>
                ) : (
                  events.map((e, i) => (
                    <li key={i} className="relative pl-5">
                      <span
                        className="absolute left-0 top-1.5 h-[11px] w-[11px] rounded-full border-2 border-[var(--card)]"
                        style={{ background: i === 0 ? ACCENT : "#c9c1b2" }}
                      />
                      <div className="text-[12.5px] font-medium text-stone-800">
                        {e.label}
                        {e.count > 1 ? <span className="ml-1 text-stone-400">×{e.count}</span> : null}
                      </div>
                      <div className="line-clamp-2 text-[11.5px] leading-snug text-stone-500">{e.summary}</div>
                      <div className="text-[11px] text-stone-400">{fmtTime(e.at)}</div>
                    </li>
                  ))
                )}
              </ol>
              <p className="mt-3 border-t border-stone-100 pt-2 text-[10.5px] text-stone-400">
                由事件 outbox 彙整，完整軌跡見事件詳情頁時間軸。
              </p>
            </section>
          </div>
        </div>
      ) : (
        <SitePreview previewPath={previewPath} apiSlug={incident?.slug ?? ""} />
      )}
    </AppShell>
  );
}

/* ── presentational helpers ──────────────────────────────── */

function Kpi({
  label, value, suffix, accent, demo,
}: {
  label: string; value: number; suffix?: string; accent?: string; demo?: boolean;
}) {
  return (
    <div className="px-4 py-3.5">
      <div className="font-display text-xl font-semibold tabular-nums" style={{ color: accent || "#1b1a17" }}>
        {value.toLocaleString()}
        {suffix ? <span className="text-sm font-normal text-stone-400">{suffix}</span> : null}
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

function Sparkline({ data }: { data: number[] }) {
  const w = 260;
  const h = 64;
  const max = Math.max(1, ...data);
  const pts = data.map((v, i) => [
    (i / (data.length - 1)) * w,
    h - (v / max) * (h - 6) - 2,
  ]);
  const line = pts.map((p) => p.join(",")).join(" ");
  const area = `0,${h} ${line} ${w},${h}`;
  return (
    <div>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full" role="img" aria-label="近 24 小時瀏覽趨勢">
        <polygon points={area} fill={ACCENT} opacity="0.12" />
        <polyline points={line} fill="none" stroke={ACCENT} strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" />
      </svg>
      <div className="flex justify-between text-[10px] text-stone-400">
        <span>24 小時前</span>
        <span>現在</span>
      </div>
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
  const risk = RISK_LABEL[b.risk_level];
  const pill =
    b.status === "approved"
      ? { t: "已上線", fg: "#4a6139", bg: "#e8efdd" }
      : b.status === "rejected"
      ? { t: "已退回", fg: "#8a4a3a", bg: "#f6e3dd" }
      : { t: "待審核", fg: "#2f5290", bg: "#e7eef9" };

  return (
    <article className="px-5 py-3.5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <span className="db-chip shrink-0" style={{ background: "#f7ece7", color: ACCENT }}>
          {TYPE_LABEL[b.artifact_type] || b.artifact_type}
        </span>
        <span className="min-w-0 flex-1">
          <span className="font-display text-[14.5px] font-semibold text-stone-900">{heading(b)}</span>
          {summary ? (
            <span className="ml-2 hidden text-xs text-stone-400 lg:inline">
              {summary.length > 42 ? `${summary.slice(0, 42)}…` : summary}
            </span>
          ) : null}
        </span>
        {risk ? (
          <span className="shrink-0 text-[11px] font-medium" style={{ color: risk.c }}>
            {risk.t}
          </span>
        ) : null}
        <span
          className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium"
          style={{ background: pill.bg, color: pill.fg }}
        >
          {pill.t}
        </span>

        <span className="flex shrink-0 items-center gap-1.5">
          {b.status === "pending_review" ? (
            <>
              <button
                type="button"
                onClick={onApprove}
                disabled={busy}
                className="db-btn db-btn-emerald !px-3 !py-1 text-xs"
              >
                {busy ? "處理中…" : "通過上線"}
              </button>
              <button
                type="button"
                onClick={onReject}
                disabled={busy}
                className="db-btn db-btn-ghost !px-3 !py-1 text-xs"
              >
                退回
              </button>
            </>
          ) : null}
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="rounded border border-stone-200 px-2 py-1 text-[11px] text-stone-500 transition hover:border-stone-300 hover:text-stone-800"
          >
            {open ? "收合 ▲" : "內容 ▼"}
          </button>
        </span>
      </div>

      {open ? (
        <div className="mt-3">
          <JsonBlock data={b.content} label="content" collapsed={false} />
        </div>
      ) : null}
    </article>
  );
}

function SitePreview({ previewPath, apiSlug }: { previewPath: string; apiSlug: string }) {
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const frameRef = useRef<HTMLIFrameElement | null>(null);

  // In-iframe navigations are pushed onto the browser's joint session
  // history, which breaks the Back button on this admin page (it un-navigates
  // the iframe instead of leaving). Intercept link clicks inside the
  // same-origin preview and open them in a new tab instead.
  const hookIframeLinks = useCallback(() => {
    const doc = frameRef.current?.contentDocument;
    if (!doc) return;
    doc.addEventListener(
      "click",
      (e) => {
        const a = (e.target as Element | null)?.closest?.("a[href]") as
          | HTMLAnchorElement
          | null;
        if (!a) return;
        e.preventDefault();
        e.stopPropagation();
        window.open(a.href, "_blank", "noopener");
      },
      true
    );
  }, []);
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
          以下為對外網站的實際樣子（僅顯示審核通過的內容）；預覽中的連結會另開新分頁。
        </p>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-lg border border-stone-200 bg-white p-0.5 text-xs">
            {(["desktop", "mobile"] as const).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDevice(d)}
                className="rounded-md px-3 py-1 font-medium transition"
                style={device === d ? { background: "#1b1a17", color: "#f4f1ec" } : { color: "#8a8275" }}
              >
                {d === "desktop" ? "桌機" : "行動版"}
              </button>
            ))}
          </div>
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
      </div>
      <div
        className="mx-auto overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm transition-all"
        style={{ maxWidth: device === "mobile" ? 400 : "100%" }}
      >
        <iframe
          ref={frameRef}
          src={previewPath}
          title="救災網站預覽"
          className="h-[72vh] w-full"
          onLoad={hookIframeLinks}
        />
      </div>
      {apiSlug ? (
        <p className="mt-2 text-center font-mono text-[11px] text-stone-400">
          公開網址 · {previewPath} · API {API_BASE}/v1/public/preview/{apiSlug}
        </p>
      ) : null}
    </div>
  );
}
