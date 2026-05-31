// API types mirroring the DisasterBlock backend.

export type Severity = "low" | "medium" | "high" | "critical";
export type IncidentStatus = "draft" | "active" | "archived";
export type ArtifactStatus =
  | "pending_review"
  | "approved"
  | "rejected"
  | "archived";
export type RiskLevel = "low" | "medium" | "high";
export type ReviewStatus = "pending" | "approved" | "rejected";
export type ReportStatus =
  | "new"
  | "triaged"
  | "in_progress"
  | "resolved"
  | "archived";
export type VerificationStatus = "unverified" | "verified" | "rejected";

export type ArtifactType =
  | "microsite_config"
  | "damage_report_form"
  | "volunteer_form"
  | "supply_form"
  | "map_bundle"
  | "public_notice_draft";

export type NeedType =
  | "flooding"
  | "mud_removal"
  | "road_blocked"
  | "trapped_person"
  | "medical_need"
  | "supply_need"
  | "other";

export interface Location {
  county?: string | null;
  town?: string | null;
  river?: string | null;
  lat?: number | null;
  lon?: number | null;
}

export interface SourceRef {
  source_name: string;
  source_ref: string;
  fetched_at?: string | null;
}

export interface IncidentListItem {
  id: string;
  slug: string;
  title: string;
  scenario_type: string;
  severity: Severity;
  county?: string | null;
  town?: string | null;
  river?: string | null;
  status: IncidentStatus;
  created_at: string;
}

export interface IncidentDetail {
  id: string;
  slug: string;
  title: string;
  scenario_type: string;
  severity: Severity;
  location: Location;
  aoi?: Record<string, unknown> | null;
  status: IncidentStatus;
  source_refs: SourceRef[];
  created_at: string;
  updated_at: string;
}

export interface IncidentListResponse {
  items: IncidentListItem[];
  total: number;
  limit: number;
  offset: number;
}

export interface CreateIncidentPayload {
  source: string;
  event_type: string;
  title: string;
  severity: Severity;
  location: Location;
  aoi?: Record<string, unknown> | null;
  source_refs: SourceRef[];
}

export interface CreateIncidentResponse {
  incident_id: string;
  slug: string;
  status: string;
  next: string;
}

export interface ArtifactItem {
  id: string;
  incident_id: string;
  artifact_type: ArtifactType;
  title?: string | null;
  status: ArtifactStatus;
  risk_level: RiskLevel;
  created_by: string;
  created_at: string;
}

export interface ArtifactDetail extends ArtifactItem {
  content: Record<string, any>;
  updated_at: string;
}

export interface ArtifactListResponse {
  items: ArtifactItem[];
  total: number;
  limit: number;
  offset: number;
}

export interface ReviewTaskItem {
  id: string;
  incident_id: string;
  artifact_id: string;
  review_type: string;
  status: ReviewStatus;
  risk_level: RiskLevel;
  decision?: string | null;
  created_at: string;
}

export interface ReviewListResponse {
  items: ReviewTaskItem[];
  total: number;
  limit: number;
  offset: number;
}

export interface ReviewDecisionResponse {
  review_task_id: string;
  artifact_id: string;
  status: ReviewStatus;
  artifact_status: ArtifactStatus;
}

export interface BootstrapResponse {
  incident_id: string;
  status: string;
  artifacts: { id: string; artifact_type: ArtifactType; status: ArtifactStatus; risk_level: RiskLevel }[];
  review_tasks: { id: string; artifact_id: string; status: ReviewStatus; risk_level: RiskLevel }[];
}

export interface ReportItem {
  id: string;
  incident_id: string;
  reporter_name?: string | null;
  need_type: NeedType;
  description: string;
  severity: Severity;
  address?: string | null;
  status: ReportStatus;
  verification_status: VerificationStatus;
  created_at: string;
}

export interface ReportListResponse {
  items: ReportItem[];
  total: number;
  limit: number;
  offset: number;
}

export interface SubmitReportPayload {
  reporter_name?: string | null;
  reporter_contact?: string | null;
  need_type: NeedType;
  description: string;
  severity: Severity;
  address?: string | null;
  lat?: number | null;
  lon?: number | null;
}

export interface SubmitReportResponse {
  report_id: string;
  status: ReportStatus;
  message: string;
}

export interface GeoJSONFeature {
  type: "Feature";
  geometry: { type: "Point"; coordinates: [number, number] };
  properties: Record<string, any>;
}

export interface GeoJSONFeatureCollection {
  type: "FeatureCollection";
  features: GeoJSONFeature[];
}

export interface PublicArtifact {
  id: string;
  artifact_type: ArtifactType;
  title?: string | null;
  content: Record<string, any>;
  risk_level: RiskLevel;
}

export interface PublicPreviewResponse {
  incident: {
    id: string;
    slug: string;
    title: string;
    scenario_type: string;
    severity: Severity;
    location: Location;
    status: IncidentStatus;
  };
  artifacts: PublicArtifact[];
  public_endpoints: {
    reports_geojson: string;
    submit_report: string;
  };
}

export interface HealthResponse {
  status: string;
  service: string;
  version: string;
}

export interface CountByKey {
  key: string;
  count: number;
}

export interface IncidentSummary {
  incident_id: string;
  slug: string;
  title: string;
  severity: Severity;
  status: IncidentStatus;
  artifacts: {
    total: number;
    pending_review: number;
    approved: number;
    rejected: number;
    archived: number;
  };
  reviews: {
    total: number;
    pending: number;
    approved: number;
    rejected: number;
  };
  reports: {
    total: number;
    geolocated: number;
    by_need_type: CountByKey[];
    by_severity: CountByKey[];
  };
  readiness: {
    bootstrapped: boolean;
    has_public_content: boolean;
    has_reports: boolean;
  };
}
