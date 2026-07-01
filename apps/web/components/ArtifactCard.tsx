"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { ArtifactItem, PublicationItem } from "@/lib/types";
import StatusBadge from "./StatusBadge";
import JsonBlock from "./JsonBlock";

const PUBLISHABLE = new Set([
  "fb_page_post",
  "line_broadcast",
  "press_release",
  "public_notice_draft",
  "clarification_notice",
  "volunteer_recruit_post",
]);

// form artifacts (have a `fields` array) that can be turned into a real Google Form
const FORM_TYPES = new Set([
  "damage_report_form",
  "volunteer_form",
  "supply_form",
  "sos_form",
  "medical_need_form",
  "vulnerable_care_list",
  "volunteer_checkin",
  "supply_donation_form",
]);

const CONNECTOR_LABEL: Record<string, string> = {
  simulated: "模擬",
  facebook_graph: "Facebook",
  line_messaging: "LINE",
  google_forms: "Google 表單",
};

const TYPE_LABELS: Record<string, string> = {
  microsite_config: "救災資訊入口設定",
  damage_report_form: "災情回報表單",
  volunteer_form: "志工報名表單",
  supply_form: "物資需求表單",
  map_bundle: "災情地圖組合",
  public_notice_draft: "公開公告草稿",
  evacuation_guide: "避難與撤離指引",
  faq: "常見問答",
  sos_form: "緊急求援登記",
  medical_need_form: "醫療需求登記",
  vulnerable_care_list: "弱勢關懷名單",
  fb_page_post: "FB 粉專貼文草稿",
  line_broadcast: "LINE 推播訊息草稿",
  press_release: "新聞稿 / 懶人包",
  volunteer_recruit_post: "志工招募貼文草稿",
  volunteer_checkin: "志工報到 / 簽到",
  supply_donation_form: "物資捐贈登記",
  supply_dashboard: "物資需求即時看板",
  shelter_map: "避難收容所地圖",
  hazard_zone_layer: "危險區 / 道路封閉圖層",
  clarification_notice: "澄清 / 闢謠公告",
};

export default function ArtifactCard({ artifact }: { artifact: ArtifactItem }) {
  const [content, setContent] = useState<Record<string, any> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [published, setPublished] = useState<PublicationItem | null>(null);
  const [pubError, setPubError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [gform, setGform] = useState<PublicationItem | null>(null);
  const [gformError, setGformError] = useState<string | null>(null);

  const canPublish =
    artifact.status === "approved" && PUBLISHABLE.has(artifact.artifact_type);
  const canExportForm =
    artifact.status === "approved" && FORM_TYPES.has(artifact.artifact_type);

  async function handlePublish() {
    setPublishing(true);
    setPubError(null);
    try {
      setPublished(await api.publishArtifact(artifact.id));
    } catch (e) {
      setPubError((e as Error).message);
    } finally {
      setPublishing(false);
    }
  }

  async function handleExportForm() {
    setExporting(true);
    setGformError(null);
    try {
      setGform(await api.exportGoogleForm(artifact.id));
    } catch (e) {
      setGformError((e as Error).message);
    } finally {
      setExporting(false);
    }
  }

  useEffect(() => {
    if (!open || content) return;
    setLoading(true);
    api
      .getArtifact(artifact.id)
      .then((d) => setContent(d.content))
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, [open, content, artifact.id]);

  return (
    <div className="db-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="font-semibold text-stone-900">
              {artifact.title ||
                TYPE_LABELS[artifact.artifact_type] ||
                artifact.artifact_type}
            </h4>
            {artifact.created_by === "ai_agent" ? (
              <span
                className="inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold tracking-wide"
                style={{ background: "#efddd3", color: "#8c3b2e" }}
              >
                AI 草擬
              </span>
            ) : null}
          </div>
          <p className="mt-1 font-mono text-[11px] tracking-tight text-stone-400">
            {artifact.artifact_type}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <StatusBadge value={artifact.status} />
          <StatusBadge value={artifact.risk_level} prefix="風險" />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="text-xs font-medium text-stone-500 transition hover:text-[#8c3b2e]"
        >
          {open ? "隱藏內容 ▲" : "查看 content 摘要 ▼"}
        </button>
        {canPublish && !published ? (
          <button
            type="button"
            onClick={handlePublish}
            disabled={publishing}
            className="rounded-md px-2 py-1 text-[11px] font-medium text-stone-50"
            style={{ background: "#8c3b2e" }}
          >
            {publishing ? "發布中…" : "發布"}
          </button>
        ) : null}
        {canExportForm && !gform ? (
          <button
            type="button"
            onClick={handleExportForm}
            disabled={exporting}
            className="rounded-md px-2 py-1 text-[11px] font-medium text-stone-50"
            style={{ background: "#6b6a3a" }}
          >
            {exporting ? "建立中…" : "建立 Google 表單"}
          </button>
        ) : null}
      </div>

      {published ? <PubResult pub={published} /> : null}
      {pubError ? <p className="mt-2 text-xs text-rose-600">{pubError}</p> : null}
      {gform ? <PubResult pub={gform} /> : null}
      {gformError ? <p className="mt-2 text-xs text-rose-600">{gformError}</p> : null}

      {open ? (
        <div className="mt-2">
          {loading ? (
            <p className="text-xs text-stone-400">載入中…</p>
          ) : error ? (
            <p className="text-xs text-rose-600">{error}</p>
          ) : content ? (
            <JsonBlock data={content} label="content" collapsed={false} />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function PubResult({ pub }: { pub: PublicationItem }) {
  const real = pub.connector !== "simulated";
  return (
    <div className="mt-2 rounded-lg bg-[#e7ebdd] px-3 py-2 text-xs text-[#4f5b3c]">
      <div className="flex flex-wrap items-center gap-1.5">
        <span
          className="rounded px-1.5 py-0.5 text-[10px] font-semibold"
          style={
            real
              ? { background: "#3a7d44", color: "#fff" }
              : { background: "#cdd3bc", color: "#4f5b3c" }
          }
        >
          {real ? "真實" : "模擬"}
        </span>
        <span className="font-medium">
          {CONNECTOR_LABEL[pub.connector] || pub.connector}
        </span>
        {pub.external_ref ? <span>· ref {pub.external_ref}</span> : null}
      </div>
      {pub.url ? (
        <a
          href={pub.url}
          target="_blank"
          rel="noreferrer"
          className="mt-1 block break-all font-medium text-[#2f5fa8] underline"
        >
          {pub.url}
        </a>
      ) : null}
      {pub.detail ? <p className="mt-1 leading-snug">{pub.detail}</p> : null}
    </div>
  );
}
