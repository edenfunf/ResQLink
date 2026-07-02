// API types mirroring the 災鏈 ResQLink backend.

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
export type TriagePriority = "critical" | "high" | "normal" | "low";
export type OfferType = "volunteer" | "supply";
export type OfferStatus = "open" | "matched" | "closed";

export type ArtifactType =
  | "microsite_config"
  | "damage_report_form"
  | "volunteer_form"
  | "supply_form"
  | "map_bundle"
  | "public_notice_draft"
  | "evacuation_guide"
  | "faq"
  | "sos_form"
  | "medical_need_form"
  | "vulnerable_care_list"
  | "fb_page_post"
  | "line_broadcast"
  | "press_release"
  | "volunteer_recruit_post"
  | "volunteer_checkin"
  | "supply_donation_form"
  | "supply_dashboard"
  | "shelter_map"
  | "hazard_zone_layer"
  | "clarification_notice"
  | "multilingual_notice"
  | "accessibility_notice"
  | "sms_alert_draft"
  | "radio_script"
  | "school_closure_notice"
  | "field_survey_form"
  | "medical_priority_roster"
  | "missing_person_board"
  | "pet_rescue_form"
  | "psych_support_booking"
  | "ig_info_card"
  | "line_rich_menu"
  | "media_kit"
  | "community_group_pack"
  | "press_conference_brief"
  | "volunteer_shift_schedule"
  | "volunteer_insurance_roster"
  | "skill_certification_registry"
  | "corporate_volunteer_pack"
  | "donation_ledger"
  | "cross_region_mutual_aid"
  | "evacuation_route_plan"
  | "flood_depth_layer"
  | "resource_poi_map"
  | "official_source_links"
  | "daily_sitrep"
  | "eoc_meeting_brief"
  | "damage_subsidy_helper"
  | "after_action_review";

export type NeedType =
  | "flooding"
  | "mud_removal"
  | "road_blocked"
  | "power_outage"
  | "building_collapse"
  | "fire"
  | "gas_leak"
  | "trapped_person"
  | "missing_person"
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
  triage_priority: TriagePriority;
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

// ── Site assistant ────────────────────────────────────────────
export interface AssistantChatResponse {
  reply: string;
  mode: "ai" | "kb";
  suggestions: string[];
}

export interface HealthResponse {
  status: string;
  service: string;
  version: string;
}

export interface ConnectorItem {
  id: string;
  name: string;
  source_type: "alert" | "dataset";
  description: string;
  homepage: string;
  has_sample: boolean;
  live_enabled: boolean;
}

export interface ConnectorListResponse {
  items: ConnectorItem[];
}

export interface IngestResult {
  created: string[];
  created_count: number;
  skipped: number;
  failed: number;
}

export interface OverviewResponse {
  incidents_total: number;
  incidents_open: number;
  reviews_pending: number;
  artifacts_pending_review: number;
  artifacts_approved: number;
  reports_total: number;
  reports_critical_open: number;
  reports_unverified: number;
  resources_open: number;
  assignments_active: number;
  publications_total: number;
}

// ── Module catalogue + Agent orchestrator ──────────────────────
export interface ModuleSpecItem {
  id: string;
  name: string;
  description: string;
  category: string;
  category_label: string;
  module_type: "generator" | "action" | "processor";
  applicable_scenarios: string[];
  default_enabled: boolean;
  implemented: boolean;
  requires_review: boolean;
  dependencies: string[];
  endpoint?: string | null;
}

export interface ModuleListResponse {
  items: ModuleSpecItem[];
  total: number;
}

export interface PlanIncident {
  id: string;
  slug: string;
  title: string;
  scenario_type: string;
  severity: Severity;
  status: IncidentStatus;
}

export interface ModuleProposal {
  id: string;
  name: string;
  description: string;
  category: string;
  category_label: string;
  module_type: "generator" | "action" | "processor";
  risk_level: RiskLevel;
  requires_review: boolean;
  recommended: boolean;
  reason: string;
  already_generated: boolean;
  /** absent in older persisted plans — treat undefined as true */
  implemented?: boolean;
  executable?: boolean;
}

export interface AgentPlanResponse {
  incident: PlanIncident;
  intent_mode: "ai" | "heuristic" | "existing";
  ai_enabled: boolean;
  note?: string | null;
  proposals: ModuleProposal[];
}

export interface AgentExecuteResult {
  module_id: string;
  status: "created" | "skipped" | "failed";
  artifact_id?: string | null;
  review_task_id?: string | null;
  detail?: string | null;
}

export interface AgentExecuteResponse {
  incident_id: string;
  results: AgentExecuteResult[];
  created_count: number;
  skipped_count: number;
  failed_count: number;
}

// ── Deliverables (outcome view) ───────────────────────────────
export type DeliverableStatus = "empty" | "draft" | "in_review" | "ready";

export interface DeliverableLink {
  label: string;
  url: string;
  kind: "internal" | "external_pending";
}

export interface DeliverableMember {
  artifact_type: ArtifactType;
  name: string;
  present: boolean;
  artifact_id?: string | null;
  status?: ArtifactStatus | null;
}

export interface DeliverableItem {
  key: string;
  name: string;
  tagline: string;
  accent: string;
  icon: string;
  status: DeliverableStatus;
  member_total: number;
  generated_count: number;
  approved_count: number;
  pending_count: number;
  front: DeliverableLink;
  admin: DeliverableLink;
  members: DeliverableMember[];
}

export interface DeliverablesResponse {
  incident_id: string;
  slug: string;
  items: DeliverableItem[];
}

// ── Timeline / Resources / Matching ───────────────────────────
export interface TimelineItem {
  event_type: string;
  label: string;
  summary: string;
  at: string;
}

export interface TimelineResponse {
  incident_id: string;
  items: TimelineItem[];
}

export interface ResourceOfferItem {
  id: string;
  incident_id: string;
  offer_type: OfferType;
  item: string;
  quantity?: number | null;
  provider_name?: string | null;
  lat?: number | null;
  lon?: number | null;
  address?: string | null;
  available_time?: string | null;
  status: OfferStatus;
  created_at: string;
}

export interface ResourceOfferListResponse {
  items: ResourceOfferItem[];
  total: number;
  limit: number;
  offset: number;
}

export interface SubmitResourcePayload {
  offer_type: OfferType;
  item: string;
  quantity?: number | null;
  provider_name?: string | null;
  provider_contact?: string | null;
  lat?: number | null;
  lon?: number | null;
  address?: string | null;
  available_time?: string | null;
}

export interface SubmitResourceResponse {
  offer_id: string;
  status: OfferStatus;
  message: string;
}

export interface MatchCandidate {
  offer_id: string;
  offer_type: OfferType;
  item: string;
  quantity?: number | null;
  address?: string | null;
  distance_km?: number | null;
  score: number;
}

export interface MatchForReport {
  report_id: string;
  need_type: NeedType;
  triage_priority: TriagePriority;
  description: string;
  address?: string | null;
  candidates: MatchCandidate[];
}

export interface MatchesResponse {
  incident_id: string;
  matched_reports: number;
  unmatched_reports: number;
  open_offers: number;
  items: MatchForReport[];
}

// ── Dispatch (assignments) ────────────────────────────────────
export type AssignmentStatus = "assigned" | "in_progress" | "done" | "cancelled";

export interface AssignmentItem {
  id: string;
  incident_id: string;
  report_id: string;
  offer_id: string;
  status: AssignmentStatus;
  note?: string | null;
  created_at: string;
  updated_at: string;
}

export interface AssignmentListResponse {
  items: AssignmentItem[];
  total: number;
}

// ── Publications (fb / line, simulated connector) ─────────────
export type Channel = "facebook" | "line";

export interface PublicationItem {
  id: string;
  incident_id: string;
  artifact_id: string;
  channel: string;
  connector: string;
  status: string;
  external_ref?: string | null;
  url?: string | null;
  detail?: string | null;
  created_at: string;
}

export interface PublicationListResponse {
  items: PublicationItem[];
  total: number;
}

// ── Generic form submissions (config-driven forms) ────────────
export interface FormField {
  name: string;
  label?: string;
  type: string; // select | textarea | text | number | multi_select | datetime
  required?: boolean;
  options?: string[];
  pii?: boolean;
}

export interface FormSubmissionCreateResponse {
  submission_id: string;
  message: string;
}

export interface FormSubmissionItem {
  id: string;
  artifact_id: string;
  form_key: string;
  payload: Record<string, unknown>;
  created_at: string;
}

export interface FormSubmissionListResponse {
  items: FormSubmissionItem[];
  total: number;
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
    critical_open: number;
    by_need_type: CountByKey[];
    by_severity: CountByKey[];
    by_triage_priority: CountByKey[];
  };
  readiness: {
    bootstrapped: boolean;
    has_public_content: boolean;
    has_reports: boolean;
  };
}
