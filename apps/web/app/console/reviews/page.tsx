"use client";

import { useCallback, useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import ReviewCard from "@/components/ReviewCard";
import { api } from "@/lib/api";
import type { ReviewStatus, ReviewTaskItem } from "@/lib/types";

const FILTERS: { value: ReviewStatus | "all"; label: string }[] = [
  { value: "pending", label: "待審核" },
  { value: "approved", label: "已通過" },
  { value: "rejected", label: "已退回" },
  { value: "all", label: "全部" },
];

export default function ReviewsPage() {
  const [reviews, setReviews] = useState<ReviewTaskItem[]>([]);
  const [filter, setFilter] = useState<ReviewStatus | "all">("pending");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    api
      .listReviews({
        status: filter === "all" ? undefined : filter,
        limit: 100,
      })
      .then((res) => setReviews(res.items))
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <AppShell>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <span className="db-eyebrow">Review</span>
          <h1 className="font-display mt-1 text-2xl font-semibold tracking-tight text-stone-900">
            審核
          </h1>
          <p className="mt-1 text-sm text-stone-500">集中審核所有救災元件</p>
        </div>
        <button type="button" onClick={load} className="db-btn db-btn-ghost">
          重新整理
        </button>
      </div>

      <div className="mt-5 inline-flex rounded-xl bg-stone-100 p-1">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setFilter(f.value)}
            className={`rounded-lg px-3.5 py-1.5 text-sm font-medium transition ${
              filter === f.value
                ? "bg-white text-stone-900 shadow-sm"
                : "text-stone-500 hover:text-stone-800"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {error ? (
        <p className="mt-6 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700 ring-1 ring-inset ring-rose-100">
          {error}
        </p>
      ) : loading ? (
        <p className="mt-6 text-sm text-stone-500">載入中…</p>
      ) : reviews.length === 0 ? (
        <div className="db-card mt-6 grid place-items-center p-10 text-center text-sm text-stone-500">
          沒有符合條件的審核任務。
        </div>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {reviews.map((r) => (
            <ReviewCard key={r.id} review={r} onChanged={load} showIncidentLink />
          ))}
        </div>
      )}
    </AppShell>
  );
}
