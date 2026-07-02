"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import dynamic from "next/dynamic";
import Link from "next/link";
import DynamicForm from "@/components/DynamicForm";
import { NEED_LABEL, PRIORITY, REPORT_STATUS_LABEL, SCENARIO_LABEL } from "@/lib/rescue";
import { centroidFor } from "@/lib/geo";
import { buildCivicInfo, OFFICIAL_LINKS, STOP_DONATION_ITEMS } from "@/lib/demoContent";
import type { DemoCivicInfo } from "@/lib/demoContent";
import { api, API_BASE } from "@/lib/api";
import type {
  AssignmentItem,
  FormField,
  GeoJSONFeatureCollection,
  IncidentSummary,
  MatchesResponse,
  PublicPreviewResponse,
  ResourceOfferItem,
} from "@/lib/types";

// Standalone public rescue portal, styled like a county EOC (災害應變中心)
// information site: light, dense, table-driven, official — deliberately unlike
// both the admin console and the generic "AI landing page" look.
const RescueMap = dynamic(() => import("@/components/RescueMap"), { ssr: false });

const NAVY = "#16324f";
const RED = "#b91c1c";

const LIVE_FORM_TYPES = new Set([
  "sos_form", "medical_need_form", "vulnerable_care_list",
  "volunteer_checkin", "supply_donation_form",
]);
const DEFAULT_CONTACTS = [
  { name: "消防救護", phone: "119" },
  { name: "警察", phone: "110" },
  { name: "災害通報專線", phone: "1991" },
];
const TRIAGE_ORDER = ["critical", "high", "normal", "low"] as const;

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
function fmtAgo(min: number): string {
  if (min < 60) return `${min} 分鐘前`;
  if (min < 1440) return `${Math.round(min / 60)} 小時前`;
  return `${Math.round(min / 1440)} 天前`;
}
function agoIso(min: number): string {
  return new Date(Date.now() - min * 60000).toLocaleString("zh-TW", {
    month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false,
  });
}
function rank(f: any): number {
  const p = f.properties?.triage_priority || f.properties?.severity;
  return ({ critical: 4, high: 3, normal: 2, medium: 2, low: 1 } as any)[p] ?? 0;
}

export default function PublicRescueSite() {
  const params = useParams<{ slug: string }>();
  const slug = decodeURIComponent(params.slug);

  const [data, setData] = useState<PublicPreviewResponse | null>(null);
  const [geojson, setGeojson] = useState<GeoJSONFeatureCollection | null>(null);
  const [summary, setSummary] = useState<IncidentSummary | null>(null);
  const [resources, setResources] = useState<ResourceOfferItem[]>([]);
  const [assignments, setAssignments] = useState<AssignmentItem[]>([]);
  const [matches, setMatches] = useState<MatchesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState<string>("");

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    api
      .getPublicPreview(slug)
      .then(async (res) => {
        if (!alive) return;
        setData(res);
        const id = res.incident.id;
        const fetchAll = async () => {
          const [gj, sm, rs, asg, mt] = await Promise.allSettled([
            api.getReportsGeoJSON(id),
            api.getIncidentSummary(id),
            api.listResources(id),
            api.listAssignments(id),
            api.getMatches(id),
          ]);
          if (!alive) return;
          if (gj.status === "fulfilled") setGeojson(gj.value);
          if (sm.status === "fulfilled") setSummary(sm.value);
          if (rs.status === "fulfilled") setResources(rs.value.items);
          if (asg.status === "fulfilled") setAssignments(asg.value.items);
          if (mt.status === "fulfilled") setMatches(mt.value);
        };
        // show existing data immediately; demo-seeding runs after and only
        // refreshes when it actually populated an empty incident
        await fetchAll();
        try {
          const seeded = await api.seedDemoActivity(id);
          if ((seeded as { seeded?: boolean }).seeded) await fetchAll();
        } catch {
          /* best-effort */
        }
      })
      .catch((e) => alive && setError((e as Error).message))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [slug]);

  useEffect(() => {
    setNow(new Date().toLocaleString("zh-TW", {
      month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false,
    }));
  }, [data]);

  const byType = useMemo(() => {
    const m: Record<string, PublicPreviewResponse["artifacts"][number]> = {};
    for (const a of data?.artifacts ?? []) m[a.artifact_type] = a;
    return m;
  }, [data]);

  const civic: DemoCivicInfo | null = useMemo(() => {
    if (!data) return null;
    const loc = data.incident.location;
    const fb = centroidFor(loc.county);
    return buildCivicInfo({
      incidentId: data.incident.id,
      scenario: data.incident.scenario_type,
      severity: data.incident.severity,
      county: loc.county,
      town: loc.town,
      centerLat: loc.lat ?? fb?.[0],
      centerLon: loc.lon ?? fb?.[1],
    });
  }, [data]);

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-slate-100">
        <div className="flex items-center gap-3 text-slate-600">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-red-700" />
          載入災害應變資訊中…
        </div>
      </div>
    );
  }
  if (error || !data || !civic) {
    return (
      <div className="grid min-h-screen place-items-center bg-slate-100 px-6">
        <div className="max-w-md border border-slate-300 bg-white p-8 text-center shadow-sm">
          <p className="text-lg font-semibold text-slate-900">找不到災害應變資訊</p>
          <p className="mt-2 text-sm text-slate-500">{error || "此災害入口尚未建立或未公開。"}</p>
        </div>
      </div>
    );
  }

  const { incident } = data;
  const loc = incident.location;
  const place = [loc.county, loc.town].filter(Boolean).join("");
  const scenarioLabel = SCENARIO_LABEL[incident.scenario_type] || incident.scenario_type;

  const notice = byType["public_notice_draft"]?.content as any;
  const microsite = byType["microsite_config"]?.content as any;
  const evac = byType["evacuation_guide"]?.content as any;
  const faq = byType["faq"]?.content as any;
  const mapBundle = byType["map_bundle"]?.content as any;

  const siteTitle = microsite?.site_title || incident.title;
  const contacts: { name: string; phone: string }[] =
    (evac?.emergency_contacts as any[])?.length ? evac.emergency_contacts : DEFAULT_CONTACTS;

  const fallback = centroidFor(loc.county);
  const center = {
    lat: mapBundle?.center?.lat ?? loc.lat ?? fallback?.[0] ?? null,
    lon: mapBundle?.center?.lon ?? loc.lon ?? fallback?.[1] ?? null,
  };
  const aoi = (mapBundle?.aoi as Record<string, unknown> | null) ?? null;

  const features = geojson?.features ?? [];
  const feed = [...features].sort((a, b) =>
    String(b.properties?.created_at).localeCompare(String(a.properties?.created_at))
  );
  const hotspots = [...features]
    .filter((f) => ["critical", "high"].includes(f.properties?.triage_priority || f.properties?.severity))
    .filter((f) => f.properties?.status !== "resolved")
    .sort((a, b) => rank(b) - rank(a))
    .slice(0, 6);

  const needBars = (summary?.reports.by_need_type ?? []).slice().sort((a, b) => b.count - a.count);
  const maxNeed = Math.max(1, ...needBars.map((n) => n.count));

  const triageCounts: Record<string, number> = {};
  for (const t of summary?.reports.by_triage_priority ?? []) triageCounts[t.key] = t.count;

  const volunteers = resources.filter((r) => r.offer_type === "volunteer");
  const supplies = resources.filter((r) => r.offer_type === "supply");
  const volunteerHeads = volunteers.reduce((s, v) => s + (v.quantity ?? 0), 0);

  const totalReports = summary?.reports.total ?? features.length;
  const criticalOpen = summary?.reports.critical_open ?? 0;
  const dispatched = assignments.length;
  const inProgress = assignments.filter((a) => a.status === "in_progress" || a.status === "assigned").length;
  const matchedReports = matches?.matched_reports ?? 0;

  const powerOut = Math.round(civic.utilities[0].affected * (1 - civic.utilities[0].restoredPct / 100));
  const closedRoads = civic.roads.filter((r) => r.status === "封閉" || r.status === "單線雙向管制").length;

  const liveForms = (data.artifacts ?? []).filter(
    (a) => LIVE_FORM_TYPES.has(a.artifact_type) && Array.isArray((a.content as any)?.fields)
  );

  const sevBadge =
    incident.severity === "critical" ? "紅色警戒"
    : incident.severity === "high" ? "橙色警戒" : "黃色警戒";
  const urgentAnn = civic.announcements.find((a) => a.level === "urgent") ?? civic.announcements[0];

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800">
      {/* ── top utility bar ── */}
      <div style={{ background: NAVY }} className="text-[12px] text-slate-300">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-1.5">
          <span className="truncate">防救災資訊服務網（示範環境）</span>
          <span className="flex shrink-0 items-center gap-3">
            <span className="hidden sm:inline">資料更新 {now}</span>
            {contacts.map((c) => (
              <a key={c.phone} href={`tel:${c.phone}`} className="font-semibold text-white hover:underline">
                {c.name} {c.phone}
              </a>
            ))}
          </span>
        </div>
      </div>

      {/* ── masthead ── */}
      <header className="border-b-4 bg-white" style={{ borderColor: RED }}>
        <div className="mx-auto max-w-7xl px-4 pb-5 pt-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span
                className="grid h-11 w-11 shrink-0 place-items-center border-2 text-[13px] font-bold leading-tight"
                style={{ borderColor: RED, color: RED }}
              >
                應變<br />中心
              </span>
              <div>
                <div className="text-lg font-bold tracking-wide" style={{ color: NAVY }}>
                  {loc.county || ""}災害應變中心
                </div>
                <div className="text-[12px] text-slate-500">
                  {scenarioLabel}應變專區 · Emergency Operations Center
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-[12px]">
              <span className="px-2.5 py-1 font-bold text-white" style={{ background: RED }}>
                {sevBadge}
              </span>
              <span className="border border-slate-300 bg-slate-50 px-2.5 py-1 font-semibold text-slate-700">
                應變中心{civic.opLevel}
              </span>
              <span className="border border-slate-300 bg-slate-50 px-2.5 py-1 text-slate-600">
                第 {civic.casualties.reportSeq} 報 · {now} 發布
              </span>
            </div>
          </div>

          <h1 className="mt-4 text-2xl font-bold leading-snug text-slate-900 sm:text-[1.9rem]">
            {siteTitle}
          </h1>
          {notice?.body ? (
            <p className="mt-2 max-w-4xl text-[14px] leading-relaxed text-slate-600">{notice.body}</p>
          ) : null}
        </div>
      </header>

      {/* ── urgent ticker ── */}
      {urgentAnn ? (
        <div style={{ background: RED }} className="text-white">
          <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-2 text-[13px]">
            <span className="shrink-0 border border-white/60 px-1.5 py-0.5 text-[11px] font-bold">最新</span>
            <span className="min-w-0 truncate font-medium">
              {urgentAnn.title}（{urgentAnn.agency} · {fmtAgo(urgentAnn.agoMin)}）
            </span>
          </div>
        </div>
      ) : null}

      {/* ── KPI strip ── */}
      <div className="border-b border-slate-300 bg-white">
        <div className="mx-auto grid max-w-7xl grid-cols-4 divide-x divide-slate-200 lg:grid-cols-8">
          <Kpi n={totalReports} label="災情通報" live />
          <Kpi n={criticalOpen} label="危急待處理" color={RED} />
          <Kpi n={dispatched} label="已派工" />
          <Kpi n={civic.casualties.sheltered} label="收容安置" />
          <Kpi n={powerOut} label="停電戶（未復電）" />
          <Kpi n={closedRoads} label="道路管制中" />
          <Kpi n={volunteerHeads} label="待命志工" color="#047857" />
          <Kpi n={supplies.length} label="物資供給批次" />
        </div>
      </div>

      {/* ═══ body ═══ */}
      <main className="mx-auto max-w-7xl space-y-8 px-4 py-7">
        {/* map + announcements */}
        <section className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <SectionHead zh="災情態勢圖" en="SITUATION MAP" />
            <div className="mt-3">
              <RescueMap
                center={center}
                aoi={aoi}
                reportsGeoJson={geojson}
                resources={resources}
                shelters={civic.shelters}
                medical={civic.medical}
                height={520}
              />
            </div>
            <p className="mt-1.5 text-[12px] text-slate-500">
              圓點為民眾通報（越大越危急）；「收」為收容所、「醫」為醫療站。對外資料一律去識別化。
            </p>
          </div>

          <aside className="flex flex-col">
            <SectionHead zh="最新公告" en="BULLETINS" />
            <div className="mt-3 max-h-[540px] divide-y divide-slate-200 overflow-y-auto border border-slate-300 bg-white">
              {civic.announcements.map((a, i) => (
                <div key={i} className="px-4 py-3">
                  <div className="flex items-center gap-2 text-[11px]">
                    <AnnBadge level={a.level} />
                    <span className="font-medium text-slate-600">{a.agency}</span>
                    {a.seq ? <span className="text-slate-400">第 {a.seq} 報</span> : null}
                    <span className="ml-auto shrink-0 text-slate-400">{agoIso(a.agoMin)}</span>
                  </div>
                  <p className="mt-1 text-[13.5px] font-semibold leading-snug text-slate-900">{a.title}</p>
                  <p className="mt-1 text-[12.5px] leading-relaxed text-slate-600">{a.body}</p>
                </div>
              ))}
            </div>
          </aside>
        </section>

        {/* casualty / rescue statistics */}
        <section style={{ background: NAVY }} className="text-white">
          <div className="grid grid-cols-2 divide-x divide-white/15 sm:grid-cols-5">
            <Stat n={civic.casualties.death} label="死亡" />
            <Stat n={civic.casualties.injured} label="受傷" />
            <Stat n={civic.casualties.missing} label="失聯" />
            <Stat n={civic.casualties.rescued} label="已救出" />
            <Stat n={civic.casualties.sheltered} label="收容安置" />
          </div>
          <div className="border-t border-white/15 px-4 py-2 text-[11.5px] text-slate-300">
            統計截至 {now} · 資料來源：{loc.county || ""}災害應變中心 第 {civic.casualties.reportSeq} 報（示範資料）
          </div>
        </section>

        {/* shelters + medical */}
        <section>
          <SectionHead zh="避難收容所" en="SHELTERS" note="前往前建議先電話確認收容情形" />
          <div className="mt-3 overflow-x-auto border border-slate-300 bg-white">
            <table className="w-full min-w-[720px] text-[13px]">
              <thead>
                <tr className="border-b border-slate-300 bg-slate-50 text-left text-[12px] text-slate-600">
                  <th className="px-4 py-2.5 font-semibold">收容所</th>
                  <th className="px-4 py-2.5 font-semibold">地址／電話</th>
                  <th className="px-4 py-2.5 font-semibold">設施</th>
                  <th className="w-52 px-4 py-2.5 font-semibold">收容情形</th>
                  <th className="w-24 px-4 py-2.5 font-semibold">狀態</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {civic.shelters.map((s, i) => {
                  const pct = Math.round((s.current / s.capacity) * 100);
                  const barColor = s.status === "full" ? RED : s.status === "nearFull" ? "#d97706" : "#047857";
                  return (
                    <tr key={i}>
                      <td className="px-4 py-2.5 font-semibold text-slate-900">{s.name}</td>
                      <td className="px-4 py-2.5 text-slate-600">
                        {s.address}
                        <br />
                        <a href={`tel:${s.phone}`} className="text-slate-500 underline">{s.phone}</a>
                      </td>
                      <td className="px-4 py-2.5 text-slate-600">{s.features.join("、")}</td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <div className="h-2 flex-1 bg-slate-200">
                            <div className="h-full" style={{ width: `${pct}%`, background: barColor }} />
                          </div>
                          <span className="shrink-0 tabular-nums text-slate-700">
                            {s.current}/{s.capacity}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5">
                        <ShelterBadge status={s.status} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {civic.medical.map((m, i) => (
              <div key={i} className="flex items-start gap-3 border border-slate-300 bg-white px-4 py-3">
                <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center text-sm font-bold text-white" style={{ background: "#be123c" }}>
                  醫
                </span>
                <div className="text-[13px]">
                  <div className="font-semibold text-slate-900">{m.name}</div>
                  <div className="text-slate-600">{m.services}</div>
                  <div className="text-[12px] text-slate-500">{m.address} · {m.hours}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* roads + lifelines */}
        <section className="grid gap-6 lg:grid-cols-2">
          <div>
            <SectionHead zh="道路交通管制" en="ROAD CLOSURES" />
            <div className="mt-3 divide-y divide-slate-200 border border-slate-300 bg-white">
              {civic.roads.map((r, i) => (
                <div key={i} className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <RoadBadge status={r.status} />
                    <span className="text-[13.5px] font-semibold text-slate-900">
                      {r.road} {r.section}
                    </span>
                    <span className="ml-auto text-[11.5px] text-slate-400">{fmtAgo(r.updatedAgoMin)}更新</span>
                  </div>
                  <p className="mt-1 text-[12.5px] text-slate-600">
                    {r.note}
                    <span className="text-slate-400">（{r.agency}）</span>
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div>
            <SectionHead zh="維生管線搶修進度" en="LIFELINES" />
            <div className="mt-3 space-y-px border border-slate-300 bg-white">
              {civic.utilities.map((u, i) => (
                <div key={i} className="px-4 py-3.5">
                  <div className="flex items-baseline justify-between text-[13px]">
                    <span className="font-semibold text-slate-900">{u.name}</span>
                    <span className="text-slate-600">
                      影響 <b className="tabular-nums">{u.affected.toLocaleString()}</b> {u.unit} · 已恢復{" "}
                      <b className="tabular-nums" style={{ color: u.restoredPct >= 80 ? "#047857" : "#d97706" }}>
                        {u.restoredPct}%
                      </b>
                    </span>
                  </div>
                  <div className="mt-2 h-2 bg-slate-200">
                    <div
                      className="h-full"
                      style={{ width: `${u.restoredPct}%`, background: u.restoredPct >= 80 ? "#047857" : "#d97706" }}
                    />
                  </div>
                  <div className="mt-1.5 flex justify-between text-[11.5px] text-slate-500">
                    <span>{u.eta}</span>
                    <span>{u.agency}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* citizen reports */}
        <section>
          <SectionHead
            zh="民眾災情通報"
            en="CITIZEN REPORTS"
            action={
              <Link
                href={`/reports/${incident.id}`}
                className="px-4 py-2 text-[13px] font-bold text-white transition hover:brightness-110"
                style={{ background: RED }}
              >
                我要通報災情 →
              </Link>
            }
          />
          <div className="mt-3 grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <div className="divide-y divide-slate-200 border border-slate-300 bg-white">
                {feed.slice(0, 10).map((f, i) => {
                  const p = f.properties?.triage_priority || f.properties?.severity;
                  const pr = PRIORITY[p] || PRIORITY.normal;
                  const status = f.properties?.status;
                  return (
                    <div key={f.properties?.report_id ?? i} className="flex gap-3 px-4 py-3">
                      <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: pr.c }} />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px]">
                          <span className="font-bold text-slate-900">
                            {NEED_LABEL[f.properties?.need_type] || f.properties?.need_type}
                          </span>
                          <span className="font-semibold" style={{ color: pr.c }}>{pr.label}</span>
                          <span
                            className="border px-1.5 py-px text-[11px]"
                            style={
                              status === "resolved"
                                ? { borderColor: "#04785755", color: "#047857", background: "#04785710" }
                                : status === "in_progress"
                                ? { borderColor: "#1d4ed855", color: "#1d4ed8", background: "#1d4ed810" }
                                : { borderColor: "#cbd5e1", color: "#64748b" }
                            }
                          >
                            {REPORT_STATUS_LABEL[status] || status}
                          </span>
                          <span className="ml-auto shrink-0 text-slate-400">{fmtTime(f.properties?.created_at)}</span>
                        </div>
                        <p className="mt-0.5 text-[13.5px] leading-snug text-slate-800">
                          {f.properties?.description || "—"}
                        </p>
                        <p className="text-[12px] text-slate-500">{f.properties?.address || "位置由通報者提供"}</p>
                      </div>
                    </div>
                  );
                })}
                {feed.length === 0 ? (
                  <p className="px-4 py-6 text-sm text-slate-500">尚無通報。</p>
                ) : null}
              </div>
            </div>

            <aside className="space-y-5">
              <div className="border border-slate-300 bg-white px-4 py-4">
                <h3 className="text-[13px] font-bold text-slate-900">分流與處理進度</h3>
                <div className="mt-3 space-y-1.5">
                  {TRIAGE_ORDER.map((k) => (
                    <div key={k} className="flex items-center gap-2 text-[12px]">
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: PRIORITY[k].c }} />
                      <span className="w-8 text-slate-600">{PRIORITY[k].label}</span>
                      <div className="h-2 flex-1 bg-slate-200">
                        <div
                          className="h-full"
                          style={{
                            width: `${((triageCounts[k] ?? 0) / Math.max(1, totalReports)) * 100}%`,
                            background: PRIORITY[k].c,
                          }}
                        />
                      </div>
                      <span className="w-6 text-right tabular-nums font-semibold text-slate-800">
                        {triageCounts[k] ?? 0}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="mt-4 grid grid-cols-3 divide-x divide-slate-200 border-t border-slate-200 pt-3 text-center">
                  <MiniStat n={dispatched} label="已派工" />
                  <MiniStat n={inProgress} label="進行中" />
                  <MiniStat n={matchedReports} label="已媒合" />
                </div>
              </div>

              <div className="border border-slate-300 bg-white px-4 py-4">
                <h3 className="text-[13px] font-bold text-slate-900">待救援熱點</h3>
                <ul className="mt-3 space-y-2.5">
                  {hotspots.length === 0 ? (
                    <li className="text-[12px] text-slate-500">目前無危急／高優先待處理通報。</li>
                  ) : (
                    hotspots.map((f, i) => {
                      const p = f.properties?.triage_priority || f.properties?.severity;
                      const pr = PRIORITY[p] || PRIORITY.normal;
                      return (
                        <li key={f.properties?.report_id ?? i} className="flex items-start gap-2">
                          <span className="mt-1 h-2 w-2 shrink-0 rounded-full" style={{ background: pr.c }} />
                          <div className="min-w-0 text-[12.5px]">
                            <span className="font-semibold text-slate-900">
                              {NEED_LABEL[f.properties?.need_type] || f.properties?.need_type}
                            </span>
                            <span className="ml-1.5 font-semibold" style={{ color: pr.c }}>{pr.label}</span>
                            <div className="truncate text-slate-500">{f.properties?.address || ""}</div>
                          </div>
                        </li>
                      );
                    })
                  )}
                </ul>
              </div>

              <div className="border border-slate-300 bg-white px-4 py-4">
                <h3 className="text-[13px] font-bold text-slate-900">需求類型分布</h3>
                <div className="mt-3 space-y-2">
                  {needBars.map((n) => (
                    <div key={n.key} className="flex items-center gap-2 text-[12px]">
                      <span className="w-16 shrink-0 text-slate-600">{NEED_LABEL[n.key] || n.key}</span>
                      <div className="h-2 flex-1 bg-slate-200">
                        <div className="h-full" style={{ width: `${(n.count / maxNeed) * 100}%`, background: NAVY }} />
                      </div>
                      <span className="w-5 text-right tabular-nums font-semibold text-slate-800">{n.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </aside>
          </div>
        </section>

        {/* supplies + volunteers */}
        <section className="grid gap-6 lg:grid-cols-2">
          <div>
            <SectionHead
              zh="物資需求看板"
              en="SUPPLY BOARD"
              action={
                <Link
                  href={`/reports/${incident.id}`}
                  className="border px-3.5 py-1.5 text-[12.5px] font-bold transition hover:bg-amber-50"
                  style={{ borderColor: "#b45309", color: "#b45309" }}
                >
                  我要捐物資 →
                </Link>
              }
            />
            <div className="mt-3 border border-slate-300 bg-white">
              <div className="divide-y divide-slate-200">
                {civic.supplyBoard.map((s, i) => {
                  const pct = Math.min(100, Math.round((s.received / s.needed) * 100));
                  const st =
                    s.status === "urgent"
                      ? { t: "急需", c: RED }
                      : s.status === "collecting"
                      ? { t: "募集中", c: "#d97706" }
                      : { t: "已足量", c: "#047857" };
                  return (
                    <div key={i} className="px-4 py-2.5">
                      <div className="flex items-center gap-2 text-[13px]">
                        <span className="border px-1.5 py-px text-[11px] font-bold" style={{ borderColor: `${st.c}66`, color: st.c }}>
                          {st.t}
                        </span>
                        <span className="font-semibold text-slate-900">{s.item}</span>
                        <span className="ml-auto tabular-nums text-slate-600">
                          {s.received.toLocaleString()} / {s.needed.toLocaleString()} {s.unit}
                        </span>
                      </div>
                      <div className="mt-1.5 h-1.5 bg-slate-200">
                        <div className="h-full" style={{ width: `${pct}%`, background: st.c }} />
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="border-t border-slate-300 bg-slate-50 px-4 py-3 text-[12px] text-slate-600">
                <b className="text-slate-800">已足量、請暫停捐贈：</b>
                {STOP_DONATION_ITEMS.join("、")}。物資請透過本站登記後再送達，勿自行前往災區。
              </div>
            </div>

            {supplies.length > 0 ? (
              <div className="mt-3 border border-slate-300 bg-white px-4 py-3">
                <h3 className="text-[13px] font-bold text-slate-900">民間物資供給（最近登記）</h3>
                <ul className="mt-2 divide-y divide-slate-100 text-[12.5px]">
                  {supplies.slice(0, 5).map((s) => (
                    <li key={s.id} className="flex items-center justify-between py-1.5">
                      <span className="text-slate-800">{s.item}</span>
                      <span className="text-slate-500">
                        {s.provider_name || "—"} · {s.quantity ?? "?"} · <OfferStatus status={s.status} />
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>

          <div>
            <SectionHead
              zh="志工動員"
              en="VOLUNTEERS"
              action={
                <Link
                  href={`/reports/${incident.id}`}
                  className="border px-3.5 py-1.5 text-[12.5px] font-bold transition hover:bg-emerald-50"
                  style={{ borderColor: "#047857", color: "#047857" }}
                >
                  我要當志工 →
                </Link>
              }
            />
            <div className="mt-3 border border-slate-300 bg-white">
              <div className="grid grid-cols-3 divide-x divide-slate-200 border-b border-slate-300 bg-slate-50 text-center">
                <MiniStat n={volunteers.length} label="志工隊伍" />
                <MiniStat n={volunteerHeads} label="可調度人數" />
                <MiniStat n={dispatched} label="已派遣" />
              </div>
              <table className="w-full text-[12.5px]">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-[11.5px] text-slate-500">
                    <th className="px-4 py-2 font-semibold">隊伍</th>
                    <th className="px-4 py-2 font-semibold">專長</th>
                    <th className="px-4 py-2 font-semibold">人數</th>
                    <th className="px-4 py-2 font-semibold">可支援時段</th>
                    <th className="px-4 py-2 font-semibold">狀態</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {volunteers.slice(0, 7).map((v) => (
                    <tr key={v.id}>
                      <td className="px-4 py-2 font-medium text-slate-900">{v.provider_name || "—"}</td>
                      <td className="px-4 py-2 text-slate-600">{v.item}</td>
                      <td className="px-4 py-2 tabular-nums text-slate-600">{v.quantity ?? "?"}</td>
                      <td className="px-4 py-2 text-slate-600">{v.available_time || "—"}</td>
                      <td className="px-4 py-2"><OfferStatus status={v.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {volunteers.length === 0 ? (
                <p className="px-4 py-4 text-[12.5px] text-slate-500">尚無志工登記，歡迎報名支援。</p>
              ) : null}
            </div>
            <p className="mt-2 text-[12px] text-slate-500">
              志工由應變中心統一編組與派遣，報名後請留意簡訊通知，未經派遣請勿自行進入管制區。
            </p>
          </div>
        </section>

        {/* evacuation + faq */}
        {(evac || faq?.items?.length) ? (
          <section className="grid gap-6 lg:grid-cols-2">
            {evac ? (
              <div>
                <SectionHead zh={evac.title || "避難與撤離指引"} en="EVACUATION" />
                <ol className="mt-3 space-y-px border border-slate-300 bg-white">
                  {(evac.steps as string[] | undefined)?.map((s, i) => (
                    <li key={i} className="flex gap-3 border-b border-slate-100 px-4 py-3 text-[13.5px] text-slate-700 last:border-b-0">
                      <span
                        className="grid h-6 w-6 shrink-0 place-items-center text-[12px] font-bold text-white"
                        style={{ background: NAVY }}
                      >
                        {i + 1}
                      </span>
                      <span className="pt-0.5">{s}</span>
                    </li>
                  ))}
                </ol>
              </div>
            ) : null}
            {faq?.items?.length ? (
              <div>
                <SectionHead zh={faq.title || "常見問答"} en="FAQ" />
                <div className="mt-3 divide-y divide-slate-200 border border-slate-300 bg-white">
                  {(faq.items as any[]).map((qa, i) => (
                    <div key={i} className="px-4 py-3">
                      <p className="text-[13.5px] font-semibold text-slate-900">Q：{qa.q}</p>
                      <p className="mt-1 text-[13px] leading-relaxed text-slate-600">A：{qa.a}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </section>
        ) : null}

        {/* live forms */}
        {liveForms.length > 0 ? (
          <section>
            <SectionHead zh="線上登記表單" en="ONLINE FORMS" />
            <div className="mt-3 grid gap-6 lg:grid-cols-2">
              {liveForms.map((a) => {
                const content = a.content as Record<string, any>;
                return (
                  <div key={a.id} className="border border-slate-300 bg-white p-1">
                    <DynamicForm
                      artifactId={a.id}
                      title={(content.title as string) || a.title || a.artifact_type}
                      notice={content.notice as string | undefined}
                      fields={content.fields as FormField[]}
                    />
                  </div>
                );
              })}
            </div>
          </section>
        ) : null}

        {/* donation + official links */}
        <section className="grid gap-6 lg:grid-cols-3">
          <div>
            <SectionHead zh="賑災捐款" en="DONATION" />
            <div className="mt-3 border border-slate-300 bg-white px-4 py-4 text-[13px]">
              <div className="font-semibold text-slate-900">{civic.donation.account}</div>
              <div className="mt-2 space-y-1 text-slate-600">
                <div>{civic.donation.bank}</div>
                <div>
                  帳號 <span className="font-mono text-[14px] font-semibold tracking-wide text-slate-900">{civic.donation.number}</span>
                </div>
              </div>
              <p className="mt-3 border-t border-slate-200 pt-2.5 text-[12px] leading-relaxed text-slate-500">
                {civic.donation.note}
              </p>
            </div>
          </div>
          <div className="lg:col-span-2">
            <SectionHead zh="官方資訊連結" en="OFFICIAL LINKS" />
            <div className="mt-3 grid gap-px border border-slate-300 bg-slate-200 sm:grid-cols-2 lg:grid-cols-3">
              {OFFICIAL_LINKS.map((l) => (
                <a
                  key={l.url}
                  href={l.url}
                  target="_blank"
                  rel="noreferrer"
                  className="group bg-white px-4 py-3.5 transition hover:bg-slate-50"
                >
                  <div className="text-[13.5px] font-semibold text-slate-900 group-hover:underline">
                    {l.name} <span className="text-slate-400">↗</span>
                  </div>
                  <div className="mt-0.5 text-[12px] text-slate-500">{l.desc}</div>
                </a>
              ))}
            </div>
          </div>
        </section>

        {/* report CTA */}
        <section className="border-l-4 bg-white px-6 py-5" style={{ borderColor: RED }}>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-bold text-slate-900">你也在災區嗎？回報災情，讓救援更快抵達</h3>
              <p className="mt-1 text-[13px] text-slate-600">
                淹水、清淤、道路中斷、受困、醫療或物資需求，都可以在這裡通報；志工報名與物資捐贈也請一併於線上登記。
              </p>
            </div>
            <div className="flex gap-2.5">
              <Link
                href={`/reports/${incident.id}`}
                className="px-5 py-2.5 text-[14px] font-bold text-white transition hover:brightness-110"
                style={{ background: RED }}
              >
                災情通報
              </Link>
              <Link
                href={`/reports/${incident.id}`}
                className="border px-5 py-2.5 text-[14px] font-bold transition hover:bg-slate-50"
                style={{ borderColor: NAVY, color: NAVY }}
              >
                志工／物資登記
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer style={{ background: NAVY }} className="text-slate-300">
        <div className="mx-auto max-w-7xl px-4 py-6 text-[12px]">
          <p className="max-w-4xl leading-relaxed">
            本頁面為公民科技輔助工具，不取代官方災害應變指揮與公告；如與官方公告不一致，以官方公告為準。
            對外資料一律去識別化。本站為<b className="text-white">示範環境</b>：收容、道路、水電、傷亡統計與捐款帳號等均為系統生成之模擬資料。
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 border-t border-white/15 pt-3 text-slate-400">
            <span>資料更新 {now}</span>
            <a
              href={`${API_BASE}${data.public_endpoints.reports_geojson}`}
              target="_blank"
              rel="noreferrer"
              className="font-mono underline hover:text-white"
            >
              開放資料 GeoJSON
            </a>
            <span>緊急電話 {contacts.map((c) => `${c.name} ${c.phone}`).join(" · ")}</span>
            <span className="ml-auto">Powered by 災鏈 ResQLink</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

/* ── presentational helpers ──────────────────────────────── */

function Kpi({ n, label, live, color }: { n: number; label: string; live?: boolean; color?: string }) {
  return (
    <div className="relative px-3 py-3 text-center sm:px-4">
      {live ? (
        <span className="absolute right-2 top-2 flex h-1.5 w-1.5">
          <span className="absolute h-full w-full animate-ping rounded-full bg-emerald-500 opacity-70" />
          <span className="relative h-1.5 w-1.5 rounded-full bg-emerald-500" />
        </span>
      ) : null}
      <div className="text-[1.55rem] font-bold leading-none tabular-nums" style={{ color: color || "#0f172a" }}>
        {n.toLocaleString()}
      </div>
      <div className="mt-1.5 text-[11.5px] text-slate-500">{label}</div>
    </div>
  );
}

function Stat({ n, label }: { n: number; label: string }) {
  return (
    <div className="px-4 py-4 text-center">
      <div className="text-3xl font-bold tabular-nums">{n.toLocaleString()}</div>
      <div className="mt-1 text-[12px] text-slate-300">{label}</div>
    </div>
  );
}

function MiniStat({ n, label }: { n: number; label: string }) {
  return (
    <div className="py-2.5">
      <div className="text-lg font-bold tabular-nums text-slate-900">{n}</div>
      <div className="text-[11px] text-slate-500">{label}</div>
    </div>
  );
}

function SectionHead({
  zh, en, note, action,
}: {
  zh: string; en?: string; note?: string; action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-2 border-b-2 border-slate-800 pb-2">
      <div className="flex items-baseline gap-2.5">
        <span className="relative top-[3px] block h-[18px] w-1.5" style={{ background: "#b91c1c" }} />
        <h2 className="text-[17px] font-bold text-slate-900">{zh}</h2>
        {en ? <span className="text-[10.5px] font-semibold tracking-[0.18em] text-slate-400">{en}</span> : null}
        {note ? <span className="hidden text-[12px] text-slate-500 sm:inline">｜{note}</span> : null}
      </div>
      {action}
    </div>
  );
}

function AnnBadge({ level }: { level: "urgent" | "warning" | "info" }) {
  const map = {
    urgent: { t: "緊急", bg: "#b91c1c", fg: "#fff" },
    warning: { t: "重要", bg: "#d97706", fg: "#fff" },
    info: { t: "資訊", bg: "#e2e8f0", fg: "#475569" },
  } as const;
  const s = map[level];
  return (
    <span className="shrink-0 px-1.5 py-px text-[10.5px] font-bold" style={{ background: s.bg, color: s.fg }}>
      {s.t}
    </span>
  );
}

function ShelterBadge({ status }: { status: "open" | "nearFull" | "full" }) {
  const map = {
    open: { t: "開放中", c: "#047857" },
    nearFull: { t: "接近額滿", c: "#d97706" },
    full: { t: "已滿", c: "#b91c1c" },
  } as const;
  const s = map[status];
  return (
    <span className="border px-2 py-0.5 text-[11.5px] font-bold" style={{ borderColor: `${s.c}66`, color: s.c }}>
      {s.t}
    </span>
  );
}

function RoadBadge({ status }: { status: string }) {
  const map: Record<string, { c: string; bg: string }> = {
    封閉: { c: "#fff", bg: "#b91c1c" },
    單線雙向管制: { c: "#fff", bg: "#d97706" },
    搶通中: { c: "#92400e", bg: "#fde68a" },
    已搶通: { c: "#fff", bg: "#047857" },
  };
  const s = map[status] || map["搶通中"];
  return (
    <span className="shrink-0 px-2 py-0.5 text-[11px] font-bold" style={{ background: s.bg, color: s.c }}>
      {status}
    </span>
  );
}

function OfferStatus({ status }: { status: string }) {
  const map: Record<string, { c: string; t: string }> = {
    open: { c: "#047857", t: "可調度" },
    matched: { c: "#1d4ed8", t: "已派遣" },
    closed: { c: "#64748b", t: "已結案" },
  };
  const s = map[status] || map.open;
  return (
    <span className="inline-flex items-center gap-1 text-[11.5px] font-semibold" style={{ color: s.c }}>
      <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: s.c }} />
      {s.t}
    </span>
  );
}
