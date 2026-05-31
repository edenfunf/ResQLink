"use client";

import { useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import type { ReviewTaskItem } from "@/lib/types";
import StatusBadge from "./StatusBadge";

const DEFAULT_APPROVE_NOTE = "內容確認可公開";
const DEFAULT_REJECT_NOTE = "內容需要補充官方來源";

const REVIEW_LABELS: Record<string, string> = {
  artifact_review: "元件審核",
  risk_review: "風險審核",
  publication_review: "公開審核",
};

export default function ReviewCard({
  review,
  onChanged,
  showIncidentLink = false,
}: {
  review: ReviewTaskItem;
  onChanged?: () => void;
  showIncidentLink?: boolean;
}) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const processed = review.status !== "pending";

  async function decide(kind: "approve" | "reject") {
    setBusy(true);
    setError(null);
    const fallback = kind === "approve" ? DEFAULT_APPROVE_NOTE : DEFAULT_REJECT_NOTE;
    const finalNote = note.trim() || fallback;
    try {
      if (kind === "approve") await api.approveReview(review.id, finalNote);
      else await api.rejectReview(review.id, finalNote);
      onChanged?.();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="db-card flex flex-col p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="font-semibold text-stone-900">
            {REVIEW_LABELS[review.review_type] || review.review_type}
          </h4>
          <p className="mt-1 font-mono text-[11px] text-stone-400">
            artifact {review.artifact_id.slice(0, 8)}…
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <StatusBadge value={review.status} />
          <StatusBadge value={review.risk_level} prefix="風險" />
        </div>
      </div>

      {showIncidentLink ? (
        <Link
          href={`/incidents/${review.incident_id}`}
          className="mt-2 inline-block text-xs text-stone-400 transition hover:text-[#8c3b2e]"
        >
          事件 {review.incident_id.slice(0, 8)}… ↗
        </Link>
      ) : null}

      {processed ? (
        <div className="mt-4 rounded-xl bg-stone-50 px-3 py-2 text-sm text-stone-500">
          已處理 ·{" "}
          <span style={{ color: review.decision === "approve" ? "#566246" : "#8a4a3a", fontWeight: 600 }}>
            {review.decision === "approve" ? "通過" : "退回"}
          </span>
        </div>
      ) : (
        <div className="mt-4 space-y-2.5">
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="審核備註（留空則用預設）"
            className="db-input mt-0"
          />
          <div className="flex gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => decide("approve")}
              className="db-btn db-btn-emerald flex-1"
            >
              通過
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => decide("reject")}
              className="db-btn db-btn-rose flex-1"
            >
              退回
            </button>
          </div>
          {error ? <p className="text-xs text-rose-600">{error}</p> : null}
        </div>
      )}
    </div>
  );
}
