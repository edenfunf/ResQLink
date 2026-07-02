"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import JsonBlock from "./JsonBlock";
import type { ArtifactType, ReviewTaskItem } from "@/lib/types";

// Human labels for every generator artifact type (shared across deliverable
// backends so each block reads as a real thing, not a raw type id).
export const TYPE_LABEL: Record<string, string> = {
  microsite_config: "網站入口設定",
  damage_report_form: "災情回報表單",
  volunteer_form: "志工報名表單",
  supply_form: "物資需求表單",
  map_bundle: "災情地圖組合",
  public_notice_draft: "公開公告",
  evacuation_guide: "避難與撤離指引",
  faq: "常見問答",
  sos_form: "緊急求援登記",
  medical_need_form: "醫療需求登記",
  vulnerable_care_list: "弱勢關懷名單",
  fb_page_post: "FB 粉專貼文",
  line_broadcast: "LINE 推播訊息",
  press_release: "新聞稿 / 懶人包",
  volunteer_recruit_post: "志工招募貼文",
  volunteer_checkin: "志工報到 / 簽到",
  supply_donation_form: "物資捐贈登記",
  supply_dashboard: "物資需求即時看板",
  shelter_map: "避難收容所地圖",
  hazard_zone_layer: "危險區 / 道路封閉圖層",
  clarification_notice: "澄清 / 闢謠公告",
  multilingual_notice: "多語公告翻譯",
  accessibility_notice: "易讀版 / 無障礙公告",
  sms_alert_draft: "災防簡訊草稿",
  radio_script: "廣播稿",
  school_closure_notice: "停班停課公告",
  field_survey_form: "現地勘查表單",
  medical_priority_roster: "維生醫療優先名冊",
  missing_person_board: "失聯協尋看板",
  pet_rescue_form: "寵物救援登記",
  psych_support_booking: "心理支持預約",
  ig_info_card: "IG 資訊圖卡",
  line_rich_menu: "LINE 圖文選單",
  media_kit: "媒體採訪資料包",
  community_group_pack: "社區群組轉傳素材",
  press_conference_brief: "記者會口徑摘要",
  volunteer_shift_schedule: "志工排班表",
  volunteer_insurance_roster: "志工保險名冊",
  skill_certification_registry: "專業技能登記",
  corporate_volunteer_pack: "企業志工團對接包",
  donation_ledger: "捐贈徵信名冊",
  cross_region_mutual_aid: "跨縣市支援請求",
  evacuation_route_plan: "避難路線規劃",
  flood_depth_layer: "淹水深度圖層",
  resource_poi_map: "救災資源點位圖",
  official_source_links: "官方資訊源連結集",
  daily_sitrep: "每日情勢報告",
  eoc_meeting_brief: "應變會議簡報",
  damage_subsidy_helper: "災損補助試算",
  after_action_review: "災後檢討報告",
};

export type ReviewBlock = {
  id: string;
  artifact_type: string;
  title?: string | null;
  status: string;
  risk_level: string;
  content: Record<string, any>;
  review: ReviewTaskItem | null;
};

/** A short, human-readable line summarising an artifact's content. */
export function summarize(content: Record<string, any>): string {
  if (!content) return "";
  if (Array.isArray(content.fields)) return `表單欄位 ${content.fields.length} 項`;
  if (Array.isArray(content.items)) return `項目 ${content.items.length} 則`;
  if (Array.isArray(content.layers)) return `地圖圖層 ${content.layers.length} 個`;
  const body =
    content.body ||
    content.summary ||
    content.intro ||
    content.description ||
    (Array.isArray(content.body_paragraphs) ? content.body_paragraphs.join(" ") : "");
  if (typeof body === "string" && body) return body;
  return "";
}

export function heading(b: ReviewBlock): string {
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

/**
 * Loads the given artifact types for an incident, resolves each one's content
 * and pending review, and exposes an approve/reject action. Shared by the
 * rescue-site / supply / volunteer deliverable backends.
 */
export function useReviewBlocks(incidentId: string, types: ArtifactType[]) {
  const [blocks, setBlocks] = useState<ReviewBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [arts, revs] = await Promise.all([
        api.listArtifacts({ incident_id: incidentId, limit: 100 }),
        api.listReviews({ incident_id: incidentId, limit: 100 }),
      ]);
      const wanted = new Set(types);
      const filtered = arts.items.filter((a) => wanted.has(a.artifact_type));
      const detailed = await Promise.all(
        filtered.map(async (a) => {
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
          } as ReviewBlock;
        })
      );
      detailed.sort(
        (x, y) =>
          types.indexOf(x.artifact_type as ArtifactType) -
          types.indexOf(y.artifact_type as ArtifactType)
      );
      setBlocks(detailed);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [incidentId, types]);

  useEffect(() => {
    load();
  }, [load]);

  const decide = useCallback(
    async (b: ReviewBlock, action: "approve" | "reject") => {
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
    },
    [load]
  );

  return { blocks, loading, error, busy, reload: load, decide, setError };
}

export function BlockRow({
  b,
  accent,
  busy,
  onApprove,
  onReject,
  approveLabel = "審核通過",
  approvedNote = "✓ 已審核通過",
}: {
  b: ReviewBlock;
  accent: string;
  busy: boolean;
  onApprove: () => void;
  onReject: () => void;
  approveLabel?: string;
  approvedNote?: string;
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
            <span className="db-chip" style={{ background: "#f1ece3", color: accent }}>
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
              {busy ? "處理中…" : approveLabel}
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
          <span className="text-xs text-[#4a6139]">{approvedNote}</span>
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

export function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="font-display text-lg font-semibold text-stone-900">{value}</div>
      <div className="text-xs text-stone-400">{label}</div>
    </div>
  );
}
