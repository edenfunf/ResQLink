// Base URL from NEXT_PUBLIC_API_BASE_URL, defaulting to the local dev backend.

import type {
  AgentExecuteResponse,
  AgentPlanResponse,
  AssistantChatResponse,
  AssignmentItem,
  AssignmentListResponse,
  AssignmentStatus,
  ArtifactDetail,
  ArtifactListResponse,
  BootstrapResponse,
  Channel,
  ConnectorListResponse,
  CreateIncidentPayload,
  CreateIncidentResponse,
  DeliverablesResponse,
  FormSubmissionCreateResponse,
  IngestResult,
  FormSubmissionListResponse,
  GeoJSONFeatureCollection,
  HealthResponse,
  IncidentDetail,
  IncidentListResponse,
  IncidentSummary,
  MatchesResponse,
  ModuleListResponse,
  OverviewResponse,
  PublicationItem,
  PublicationListResponse,
  PublicPreviewResponse,
  ReportListResponse,
  ResourceOfferListResponse,
  ReviewDecisionResponse,
  ReviewListResponse,
  SubmitReportPayload,
  SubmitReportResponse,
  SubmitResourcePayload,
  SubmitResourceResponse,
  TimelineResponse,
} from "./types";

// API base resolution, in order:
// 1. NEXT_PUBLIC_API_BASE_URL baked in at build time
// 2. convention on deployed hosts: api.<same-domain> (e.g. edenshu.uk → api.edenshu.uk)
// 3. local dev fallback
function resolveApiBase(): string {
  if (process.env.NEXT_PUBLIC_API_BASE_URL) {
    return process.env.NEXT_PUBLIC_API_BASE_URL;
  }
  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    if (host !== "localhost" && host !== "127.0.0.1") {
      return `${window.location.protocol}//api.${host.replace(/^www\./, "")}`;
    }
  }
  return "http://localhost:8000";
}

export const API_BASE = resolveApiBase().replace(/\/$/, "");

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    // Only send Content-Type when there is a body: bare GETs then count as
    // CORS "simple requests" and skip the OPTIONS preflight round-trip, which
    // matters a lot once the API is a cross-origin cloud host.
    const headers: Record<string, string> = {
      ...((init?.headers as Record<string, string>) || {}),
    };
    if (init?.body && !headers["Content-Type"]) {
      headers["Content-Type"] = "application/json";
    }
    res = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers,
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

  getOverview: () => request<OverviewResponse>("/v1/overview"),

  listConnectors: () => request<ConnectorListResponse>("/v1/connectors"),

  connectorDemo: (source: string) =>
    request<IngestResult>(`/v1/connectors/${source}/demo`, { method: "POST" }),

  connectorSync: (source: string) =>
    request<IngestResult>(`/v1/connectors/${source}/sync`, { method: "POST" }),

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

  getDeliverables: (id: string) =>
    request<DeliverablesResponse>(`/v1/incidents/${id}/deliverables`),

  // site assistant: Q&A about the system itself
  assistantChat: (message: string, history: { role: string; content: string }[]) =>
    request<AssistantChatResponse>(`/v1/assistant/chat`, {
      method: "POST",
      body: JSON.stringify({ message, history }),
    }),

  // demo mode: seed fake citizen reports + resource offers for an incident
  seedDemoActivity: (id: string, force = false) =>
    request<Record<string, unknown>>(
      `/v1/incidents/${id}/demo-activity${force ? "?force=true" : ""}`,
      { method: "POST" }
    ),

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

  setReportVerification: (
    reportId: string,
    verification_status: "verified" | "rejected" | "unverified",
    note?: string
  ) =>
    request<unknown>(`/v1/reports/${reportId}/verification`, {
      method: "POST",
      body: JSON.stringify({ verification_status, note: note ?? null }),
    }),

  getReportsGeoJSON: (incidentId: string) =>
    request<GeoJSONFeatureCollection>(`/v1/incidents/${incidentId}/reports.geojson`),

  getPublicPreview: (slug: string) =>
    request<PublicPreviewResponse>(`/v1/public/preview/${encodeURIComponent(slug)}`),

  listModules: (params: { scenario?: string; category?: string; implemented?: boolean } = {}) =>
    request<ModuleListResponse>(
      `/v1/modules${qs({
        scenario: params.scenario,
        category: params.category,
        implemented:
          params.implemented === undefined ? undefined : String(params.implemented),
      })}`
    ),

  agentPlan: (message: string, incidentId?: string) =>
    request<AgentPlanResponse>("/v1/agent/plan", {
      method: "POST",
      body: JSON.stringify({ message, incident_id: incidentId ?? null }),
    }),

  agentExecute: (incidentId: string, moduleIds: string[]) =>
    request<AgentExecuteResponse>("/v1/agent/execute", {
      method: "POST",
      body: JSON.stringify({ incident_id: incidentId, module_ids: moduleIds }),
    }),

  getTimeline: (incidentId: string) =>
    request<TimelineResponse>(`/v1/incidents/${incidentId}/timeline`),

  listResources: (incidentId: string, params: { offer_type?: string; status?: string } = {}) =>
    request<ResourceOfferListResponse>(`/v1/incidents/${incidentId}/resources${qs(params)}`),

  submitResource: (incidentId: string, payload: SubmitResourcePayload) =>
    request<SubmitResourceResponse>(`/v1/incidents/${incidentId}/resources`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  getMatches: (incidentId: string) =>
    request<MatchesResponse>(`/v1/incidents/${incidentId}/matches`),

  createAssignment: (
    incidentId: string,
    payload: { report_id: string; offer_id: string; note?: string | null }
  ) =>
    request<AssignmentItem>(`/v1/incidents/${incidentId}/assignments`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  listAssignments: (incidentId: string) =>
    request<AssignmentListResponse>(`/v1/incidents/${incidentId}/assignments`),

  updateAssignment: (assignmentId: string, status: AssignmentStatus, note?: string) =>
    request<AssignmentItem>(`/v1/assignments/${assignmentId}`, {
      method: "PATCH",
      body: JSON.stringify({ status, note: note ?? null }),
    }),

  publishArtifact: (artifactId: string, channel?: Channel) =>
    request<PublicationItem>(`/v1/artifacts/${artifactId}/publish`, {
      method: "POST",
      body: JSON.stringify({ channel: channel ?? null }),
    }),

  exportGoogleForm: (artifactId: string) =>
    request<PublicationItem>(`/v1/artifacts/${artifactId}/google-form`, {
      method: "POST",
    }),

  listPublications: (incidentId: string) =>
    request<PublicationListResponse>(`/v1/incidents/${incidentId}/publications`),

  submitForm: (artifactId: string, payload: Record<string, unknown>) =>
    request<FormSubmissionCreateResponse>(`/v1/artifacts/${artifactId}/submissions`, {
      method: "POST",
      body: JSON.stringify({ payload }),
    }),

  listFormSubmissions: (artifactId: string) =>
    request<FormSubmissionListResponse>(`/v1/artifacts/${artifactId}/submissions`),
};
