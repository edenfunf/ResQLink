"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import ArtifactCard from "@/components/ArtifactCard";
import ReviewCard from "@/components/ReviewCard";
import ReportList from "@/components/ReportList";
import StatusBadge from "@/components/StatusBadge";
import JsonBlock from "@/components/JsonBlock";
import SituationSummary from "@/components/SituationSummary";
import DemoGuide from "@/components/DemoGuide";
import { api } from "@/lib/api";
import type {
  ArtifactItem,
  IncidentDetail,
  IncidentSummary,
  ReportItem,
  ReviewTaskItem,
} from "@/lib/types";

export default function IncidentDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [incident, setIncident] = useState<IncidentDetail | null>(null);
  const [artifacts, setArtifacts] = useState<ArtifactItem[]>([]);
  const [reviews, setReviews] = useState<ReviewTaskItem[]>([]);
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [summary, setSummary] = useState<IncidentSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bootBusy, setBootBusy] = useState(false);
  const [bootMsg, setBootMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [inc, arts, revs, reps, sum] = await Promise.all([
        api.getIncident(id),
        api.listArtifacts({ incident_id: id, limit: 100 }),
        api.listReviews({ incident_id: id, limit: 100 }),
        api.listReports(id),
        api.getIncidentSummary(id),
      ]);
      setIncident(inc);
      setArtifacts(arts.items);
      setReviews(revs.items);
      setReports(reps.items);
      setSummary(sum);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleBootstrap(useAi = false) {
    setBootBusy(true);
    setBootMsg(useAi ? "AI 正在並行草擬，稍候…" : null);
    try {
      const res = await api.bootstrapIncident(id, useAi);
      const how = useAi ? "（AI 草擬，待審核）" : "";
      setBootMsg(
        `Bootstrap 完成${how}：${res.artifacts.length} 個 artifact、${res.review_tasks.length} 筆審核任務。`
      );
      await load();
    } catch (e) {
      setBootMsg(`Bootstrap 失敗：${(e as Error).message}`);
    } finally {
      setBootBusy(false);
    }
  }

  if (loading) {
    return (
      <AppShell>
        <div className="db-card h-48 animate-pulse bg-stone-100/60" />
      </AppShell>
    );
  }

  if (error || !incident) {
    return (
      <AppShell>
        <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700 ring-1 ring-inset ring-rose-100">
          {error || "找不到事件"}
        </p>
        <Link href="/console" className="mt-4 inline-block text-sm text-stone-500 hover:text-stone-900">
          ← 返回管理台
        </Link>
      </AppShell>
    );
  }

  const loc = incident.location;
  const place = [loc.county, loc.town, loc.river].filter(Boolean).join(" · ");

  return (
    <AppShell>
      <Link
        href="/console"
        className="text-sm text-stone-400 transition hover:text-stone-700"
      >
        ← 管理台
      </Link>

      {summary ? (
        <div className="mt-3">
          <DemoGuide
            summary={summary}
            slug={incident.slug}
            incidentId={incident.id}
            onBootstrap={handleBootstrap}
            bootBusy={bootBusy}
          />
        </div>
      ) : null}

      <section className="db-card mt-3 p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-tight text-stone-900">
              {incident.title}
            </h1>
            <p className="mt-1.5 font-mono text-xs text-stone-400">slug · {incident.slug}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <StatusBadge value={incident.severity} prefix="嚴重度" />
            <StatusBadge value={incident.status} />
            <span className="db-chip">{incident.scenario_type}</span>
          </div>
        </div>

        {place ? <p className="mt-3 text-sm text-stone-600">{place}</p> : null}
        {loc.lat != null && loc.lon != null ? (
          <p className="mt-1 font-mono text-xs text-stone-400">
            {loc.lat}, {loc.lon}
          </p>
        ) : null}

        <div className="mt-5 grid gap-3 lg:grid-cols-2">
          <JsonBlock data={incident.source_refs} label="source_refs" />
          <JsonBlock data={incident.aoi ?? {}} label="aoi (GeoJSON)" />
        </div>
      </section>

      {summary ? (
        <div className="mt-4">
          <SituationSummary summary={summary} />
        </div>
      ) : null}

      <section className="db-card mt-4 p-5">
        <span className="db-eyebrow">Actions</span>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => handleBootstrap(false)}
            disabled={bootBusy}
            className="db-btn db-btn-ghost"
          >
            {bootBusy ? "生成中…" : "規則式生成"}
          </button>
          <button
            type="button"
            onClick={() => handleBootstrap(true)}
            disabled={bootBusy}
            className="db-btn db-btn-accent"
          >
            以 AI 生成（beta）
          </button>
          <Link
            href={`/preview/${encodeURIComponent(incident.slug)}`}
            className="db-btn db-btn-ghost"
          >
            查看公開 Preview
          </Link>
          <Link href={`/reports/${incident.id}`} className="db-btn db-btn-ghost">
            前往民眾通報頁
          </Link>
        </div>
        {bootMsg ? <p className="mt-3 text-sm text-stone-600">{bootMsg}</p> : null}
      </section>

      <section className="mt-8">
        <div className="flex items-baseline gap-2">
          <h2 className="db-section-title">生成元件</h2>
          <span className="text-sm text-stone-400">Artifacts · {artifacts.length}</span>
        </div>
        {artifacts.length === 0 ? (
          <div className="db-card mt-3 p-5 text-sm text-stone-500">
            尚未生成任何元件，請按上方「Bootstrap 生成元件」。
          </div>
        ) : (
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            {artifacts.map((a) => (
              <ArtifactCard key={a.id} artifact={a} />
            ))}
          </div>
        )}
      </section>

      <section className="mt-8">
        <div className="flex items-baseline gap-2">
          <h2 className="db-section-title">審核任務</h2>
          <span className="text-sm text-stone-400">Reviews · {reviews.length}</span>
        </div>
        {reviews.length === 0 ? (
          <div className="db-card mt-3 p-5 text-sm text-stone-500">尚無審核任務。</div>
        ) : (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {reviews.map((r) => (
              <ReviewCard key={r.id} review={r} onChanged={load} />
            ))}
          </div>
        )}
      </section>

      <section className="mt-8">
        <div className="flex items-baseline gap-2">
          <h2 className="db-section-title">民眾通報</h2>
          <span className="text-sm text-stone-400">Reports · {reports.length}</span>
        </div>
        <div className="mt-4">
          <ReportList reports={reports} />
        </div>
      </section>
    </AppShell>
  );
}
