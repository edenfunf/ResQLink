"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import dynamic from "next/dynamic";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import DynamicReportForm from "@/components/DynamicReportForm";
import ResourceForm from "@/components/ResourceForm";
import ReportList from "@/components/ReportList";
import { api } from "@/lib/api";
import type {
  GeoJSONFeatureCollection,
  IncidentDetail,
  ReportItem,
} from "@/lib/types";

const DisasterMap = dynamic(() => import("@/components/DisasterMap"), {
  ssr: false,
});

export default function ReportsPage() {
  const params = useParams<{ incidentId: string }>();
  const incidentId = params.incidentId;

  const [incident, setIncident] = useState<IncidentDetail | null>(null);
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [geojson, setGeojson] = useState<GeoJSONFeatureCollection | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadReports = useCallback(async () => {
    try {
      const [reps, gj] = await Promise.all([
        api.listReports(incidentId),
        api.getReportsGeoJSON(incidentId),
      ]);
      setReports(reps.items);
      setGeojson(gj);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [incidentId]);

  useEffect(() => {
    api
      .getIncident(incidentId)
      .then(setIncident)
      .catch((e) => setError((e as Error).message));
    loadReports();
  }, [incidentId, loadReports]);

  const center = incident
    ? { lat: incident.location.lat, lon: incident.location.lon }
    : null;

  return (
    <AppShell>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <span className="db-eyebrow">Report</span>
          <h1 className="font-display mt-1 text-2xl font-semibold tracking-tight text-stone-900">
            民眾災情通報
          </h1>
          {incident ? (
            <p className="mt-1 text-sm text-stone-500">事件 · {incident.title}</p>
          ) : null}
        </div>
        <Link href={`/incidents/${incidentId}`} className="db-btn db-btn-ghost">
          回事件詳細頁
        </Link>
      </div>

      {error ? (
        <p className="mt-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700 ring-1 ring-inset ring-rose-100">
          {error}
        </p>
      ) : null}

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div>
          <h2 className="db-section-title mb-3">提交通報</h2>
          <DynamicReportForm
            incidentId={incidentId}
            defaultCenter={center ?? undefined}
            onSubmitted={loadReports}
          />

          <h2 className="db-section-title mb-3 mt-6">我可以幫忙（志工 / 物資）</h2>
          <ResourceForm incidentId={incidentId} />
        </div>

        <div>
          <h2 className="db-section-title mb-3">災情地圖</h2>
          <DisasterMap
            center={center}
            aoi={incident?.aoi ?? null}
            reportsGeoJson={geojson}
            height={360}
          />
          <h2 className="db-section-title mb-3 mt-6">
            目前通報 · {reports.length}
          </h2>
          <ReportList reports={reports} />
        </div>
      </div>
    </AppShell>
  );
}
