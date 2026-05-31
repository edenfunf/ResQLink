"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import dynamic from "next/dynamic";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import StatusBadge from "@/components/StatusBadge";
import { api, API_BASE } from "@/lib/api";
import type {
  GeoJSONFeatureCollection,
  PublicPreviewResponse,
} from "@/lib/types";

const DisasterMap = dynamic(() => import("@/components/DisasterMap"), {
  ssr: false,
});

const DISCLAIMER = "本頁面為公民科技輔助工具，不取代官方災害應變指揮與公告。";

export default function PreviewPage() {
  const params = useParams<{ slug: string }>();
  const slug = decodeURIComponent(params.slug);

  const [data, setData] = useState<PublicPreviewResponse | null>(null);
  const [geojson, setGeojson] = useState<GeoJSONFeatureCollection | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    api
      .getPublicPreview(slug)
      .then(async (res) => {
        if (!alive) return;
        setData(res);
        try {
          const gj = await api.getReportsGeoJSON(res.incident.id);
          if (alive) setGeojson(gj);
        } catch {
        }
      })
      .catch((e) => alive && setError((e as Error).message))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [slug]);

  const byType = useMemo(() => {
    const m: Record<string, PublicPreviewResponse["artifacts"][number]> = {};
    for (const a of data?.artifacts ?? []) m[a.artifact_type] = a;
    return m;
  }, [data]);

  if (loading) {
    return (
      <AppShell>
        <div className="db-card h-48 animate-pulse bg-stone-100/60" />
      </AppShell>
    );
  }

  if (error || !data) {
    return (
      <AppShell>
        <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700 ring-1 ring-inset ring-rose-100">
          {error || "找不到公開內容"}
        </p>
      </AppShell>
    );
  }

  const { incident, public_endpoints } = data;
  const loc = incident.location;
  const place = [loc.county, loc.town, loc.river].filter(Boolean).join(" · ");

  const notice = byType["public_notice_draft"];
  const microsite = byType["microsite_config"];
  const mapBundle = byType["map_bundle"];

  const sections: { key: string; title: string; enabled: boolean }[] =
    (microsite?.content?.sections as any[]) ?? [];

  const mbCenter = mapBundle?.content?.center as
    | { lat?: number; lon?: number }
    | undefined;
  const center = {
    lat: mbCenter?.lat ?? loc.lat ?? null,
    lon: mbCenter?.lon ?? loc.lon ?? null,
  };
  const aoi = (mapBundle?.content?.aoi as Record<string, unknown> | null) ?? null;

  const hasApproved = data.artifacts.length > 0;

  return (
    <AppShell>
      <section className="db-card relative overflow-hidden px-7 py-10 sm:px-10">
        <div
          className="pointer-events-none absolute right-0 top-0 h-full w-1/2 opacity-50"
          style={{
            backgroundImage:
              "repeating-linear-gradient(135deg, rgba(140,59,46,.05) 0 1px, transparent 1px 22px)",
            maskImage: "linear-gradient(to left, black, transparent 80%)",
          }}
        />
        <div className="relative">
          <span className="db-eyebrow">公開救災入口 · 僅顯示審核通過內容</span>
          <h1 className="font-display mt-3 text-3xl font-semibold tracking-tight text-stone-900 sm:text-4xl">
            {incident.title}
          </h1>
          <div className="mt-3 h-px w-12" style={{ background: "#8c3b2e" }} />
          <p className="mt-4 max-w-xl text-sm leading-relaxed text-stone-500">
            這是民眾在災時會看到的公開頁面——<b className="text-stone-700">只顯示人工審核通過的內容</b>，
            地圖上的點是民眾即時通報，且對外輸出不含個資。
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-stone-500">
            <StatusBadge value={incident.severity} prefix="嚴重度" />
            <span className="db-chip">{incident.scenario_type}</span>
            {place ? <span>{place}</span> : null}
          </div>
        </div>
      </section>

      {!hasApproved ? (
        <div className="db-card mt-6 grid place-items-center p-12 text-center">
          <p className="text-stone-700">尚無通過審核的公開內容。</p>
          <p className="mt-1.5 text-sm text-stone-400">
            請於管理台 Bootstrap 並 approve 至少一個 artifact 後再回到此頁。
          </p>
        </div>
      ) : (
        <>
          {notice ? (
            <section
              className="mt-6 overflow-hidden rounded-xl border p-6"
              style={{ borderColor: "#e4d3b6", background: "linear-gradient(135deg,#faf4e6,#f6ece0)" }}
            >
              <div className="flex items-center gap-2.5">
                <span
                  className="grid h-6 w-6 place-items-center rounded-md text-white"
                  style={{ background: "#8c3b2e" }}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" strokeLinejoin="round" />
                  </svg>
                </span>
                <h2 className="font-display text-lg font-semibold" style={{ color: "#6b4e1f" }}>
                  {(notice.content?.title as string) || "重要公告"}
                </h2>
              </div>
              <p className="mt-3 whitespace-pre-line text-sm leading-relaxed" style={{ color: "#5f4a26" }}>
                {notice.content?.body as string}
              </p>
              {notice.content?.disclaimer ? (
                <p className="mt-3 border-t pt-3 text-xs" style={{ borderColor: "#e8d8b8", color: "#897043" }}>
                  {notice.content.disclaimer as string}
                </p>
              ) : null}
            </section>
          ) : null}

          <section className="mt-6 grid gap-4 sm:grid-cols-2">
            <Link
              href={`/reports/${incident.id}`}
              className="db-card db-card-hover group p-5"
            >
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-stone-900">災情回報</h3>
                <span className="text-stone-300 transition group-hover:text-[#8c3b2e]">→</span>
              </div>
              <p className="mt-1.5 text-sm text-stone-500">
                提供民眾回報淹水、清淤、道路中斷或其他需求。
              </p>
            </Link>
            <div className="db-card p-5">
              <h3 className="font-semibold text-stone-900">GeoJSON 圖層</h3>
              <a
                href={`${API_BASE}${public_endpoints.reports_geojson}`}
                target="_blank"
                rel="noreferrer"
                className="mt-1.5 block break-all font-mono text-xs text-[#8c3b2e] transition hover:text-[#6f2f24]"
              >
                {public_endpoints.reports_geojson}
              </a>
            </div>
          </section>

          {sections.length > 0 ? (
            <section className="mt-6">
              <span className="db-eyebrow">Microsite</span>
              <h2 className="db-section-title mt-1">頁面區塊</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {sections.map((s) => (
                  <span
                    key={s.key}
                    className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm ring-1 ring-inset"
                    style={
                      s.enabled
                        ? ({ background: "#e7ebdd", color: "#4f5b3c", "--tw-ring-color": "#d7dec8" } as React.CSSProperties)
                        : ({ background: "#f3efe7", color: "#a89e8e", "--tw-ring-color": "#e7e1d7" } as React.CSSProperties)
                    }
                  >
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: s.enabled ? "#6f7a4e" : "#cabfac" }} />
                    {s.title}
                  </span>
                ))}
              </div>
            </section>
          ) : null}

          <section className="mt-6">
            <span className="db-eyebrow">Map</span>
            <h2 className="db-section-title mt-1">災情地圖</h2>
            <div className="mt-3">
              <DisasterMap center={center} aoi={aoi} reportsGeoJson={geojson} height={420} />
            </div>
          </section>
        </>
      )}

      <p className="mt-8 rounded-xl border border-stone-200 bg-white px-4 py-3 text-xs text-stone-500">
        {DISCLAIMER}
      </p>
    </AppShell>
  );
}
