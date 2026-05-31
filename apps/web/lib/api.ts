// Base URL from NEXT_PUBLIC_API_BASE_URL, defaulting to the local dev backend.

import type {
  ArtifactDetail,
  ArtifactListResponse,
  BootstrapResponse,
  CreateIncidentPayload,
  CreateIncidentResponse,
  GeoJSONFeatureCollection,
  HealthResponse,
  IncidentDetail,
  IncidentListResponse,
  IncidentSummary,
  PublicPreviewResponse,
  ReportListResponse,
  ReviewDecisionResponse,
  ReviewListResponse,
  SubmitReportPayload,
  SubmitReportResponse,
} from "./types";

export const API_BASE = (
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000"
).replace(/\/$/, "");

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers || {}),
      },
      cache: "no-store",
    });
  } catch (err) {
    throw new Error(
      `無法連線到 API (${API_BASE})，請確認後端是否啟動。原始錯誤：${
        (err as Error).message
      }`
    );
  }

  if (!res.ok) {
    let detail = `${res.status} ${res.statusText}`;
    try {
      const body = await res.json();
      if (body?.detail) {
        detail =
          typeof body.detail === "string"
            ? body.detail
            : JSON.stringify(body.detail);
      }
    } catch {
    }
    throw new Error(detail);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

function qs(params: Record<string, string | number | undefined | null>): string {
  const search = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") search.set(k, String(v));
  }
  const s = search.toString();
  return s ? `?${s}` : "";
}

export const api = {
  health: () => request<HealthResponse>("/v1/health"),

  createIncident: (payload: CreateIncidentPayload) =>
    request<CreateIncidentResponse>("/v1/events/alerts", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  listIncidents: (params: { status?: string; severity?: string; limit?: number; offset?: number } = {}) =>
    request<IncidentListResponse>(`/v1/incidents${qs(params)}`),

  getIncident: (id: string) => request<IncidentDetail>(`/v1/incidents/${id}`),

  getIncidentSummary: (id: string) =>
    request<IncidentSummary>(`/v1/incidents/${id}/summary`),

  bootstrapIncident: (id: string, useAi = false) =>
    request<BootstrapResponse>(
      `/v1/bootstrap/incidents/${id}${useAi ? "?use_ai=true" : ""}`,
      { method: "POST" }
    ),

  listArtifacts: (params: {
    incident_id?: string;
    status?: string;
    artifact_type?: string;
    limit?: number;
    offset?: number;
  } = {}) => request<ArtifactListResponse>(`/v1/artifacts${qs(params)}`),

  getArtifact: (id: string) => request<ArtifactDetail>(`/v1/artifacts/${id}`),

  listReviews: (params: { incident_id?: string; status?: string; limit?: number; offset?: number } = {}) =>
    request<ReviewListResponse>(`/v1/reviews${qs(params)}`),

  approveReview: (id: string, note?: string) =>
    request<ReviewDecisionResponse>(`/v1/reviews/${id}/approve`, {
      method: "POST",
      body: JSON.stringify({ note: note ?? null }),
    }),

  rejectReview: (id: string, note?: string) =>
    request<ReviewDecisionResponse>(`/v1/reviews/${id}/reject`, {
      method: "POST",
      body: JSON.stringify({ note: note ?? null }),
    }),

  submitReport: (incidentId: string, payload: SubmitReportPayload) =>
    request<SubmitReportResponse>(`/v1/incidents/${incidentId}/reports`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  listReports: (incidentId: string, params: { status?: string; need_type?: string; severity?: string } = {}) =>
    request<ReportListResponse>(`/v1/incidents/${incidentId}/reports${qs(params)}`),

  getReportsGeoJSON: (incidentId: string) =>
    request<GeoJSONFeatureCollection>(`/v1/incidents/${incidentId}/reports.geojson`),

  getPublicPreview: (slug: string) =>
    request<PublicPreviewResponse>(`/v1/public/preview/${encodeURIComponent(slug)}`),
};
