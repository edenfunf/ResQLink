"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { ArtifactItem } from "@/lib/types";
import StatusBadge from "./StatusBadge";
import JsonBlock from "./JsonBlock";

const TYPE_LABELS: Record<string, string> = {
  microsite_config: "救災資訊入口設定",
  damage_report_form: "災情回報表單",
  volunteer_form: "志工報名表單",
  supply_form: "物資需求表單",
  map_bundle: "災情地圖組合",
  public_notice_draft: "公開公告草稿",
};

export default function ArtifactCard({ artifact }: { artifact: ArtifactItem }) {
  const [content, setContent] = useState<Record<string, any> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

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

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="mt-4 text-xs font-medium text-stone-500 transition hover:text-[#8c3b2e]"
      >
        {open ? "隱藏內容 ▲" : "查看 content 摘要 ▼"}
      </button>

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
