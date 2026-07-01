"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import type { OfferType } from "@/lib/types";

export default function ResourceForm({
  incidentId,
  onSubmitted,
}: {
  incidentId: string;
  onSubmitted?: () => void;
}) {
  const [offerType, setOfferType] = useState<OfferType>("volunteer");
  const [form, setForm] = useState({
    item: "",
    quantity: "",
    provider_name: "",
    provider_contact: "",
    address: "",
    available_time: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  function set<K extends keyof typeof form>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.item.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await api.submitResource(incidentId, {
        offer_type: offerType,
        item: form.item.trim(),
        quantity: form.quantity.trim() ? Number(form.quantity) : null,
        provider_name: form.provider_name.trim() || null,
        provider_contact: form.provider_contact.trim() || null,
        address: form.address.trim() || null,
        available_time: form.available_time.trim() || null,
      });
      setDone(true);
      setForm({
        item: "",
        quantity: "",
        provider_name: "",
        provider_contact: "",
        address: "",
        available_time: "",
      });
      onSubmitted?.();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="db-card space-y-4 p-5">
      <div>
        <label className="db-label">我要登記</label>
        <div className="mt-1 flex gap-2">
          {(["volunteer", "supply"] as OfferType[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setOfferType(t)}
              className={`flex-1 rounded-lg px-3 py-2 text-sm transition ${
                offerType === t
                  ? "text-stone-50"
                  : "bg-stone-100 text-stone-600 hover:bg-stone-200"
              }`}
              style={offerType === t ? { background: "#1b1a17" } : undefined}
            >
              {t === "volunteer" ? "志工人力" : "物資"}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="db-label">
            {offerType === "volunteer" ? "可協助項目" : "物資品項"}
          </label>
          <input
            className="db-input"
            required
            placeholder={offerType === "volunteer" ? "例如：清淤、搬運" : "例如：飲用水、雨鞋"}
            value={form.item}
            onChange={(e) => set("item", e.target.value)}
          />
        </div>
        <div>
          <label className="db-label">數量 / 人數（選填）</label>
          <input
            className="db-input"
            inputMode="numeric"
            value={form.quantity}
            onChange={(e) => set("quantity", e.target.value)}
          />
        </div>
        <div>
          <label className="db-label">名稱 / 單位（選填）</label>
          <input
            className="db-input"
            value={form.provider_name}
            onChange={(e) => set("provider_name", e.target.value)}
          />
        </div>
        <div>
          <label className="db-label">聯絡方式（選填）</label>
          <input
            className="db-input"
            value={form.provider_contact}
            onChange={(e) => set("provider_contact", e.target.value)}
          />
        </div>
        <div>
          <label className="db-label">地點（選填）</label>
          <input
            className="db-input"
            value={form.address}
            onChange={(e) => set("address", e.target.value)}
          />
        </div>
        <div>
          <label className="db-label">可支援時間（選填）</label>
          <input
            className="db-input"
            value={form.available_time}
            onChange={(e) => set("available_time", e.target.value)}
          />
        </div>
      </div>

      {error ? (
        <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-inset ring-rose-100">
          {error}
        </p>
      ) : null}
      {done ? (
        <p className="rounded-xl bg-[#e7ebdd] px-3 py-2 text-sm text-[#4f5b3c]">
          已登記，感謝您！將納入需求媒合。
        </p>
      ) : null}

      <button type="submit" disabled={busy} className="db-btn db-btn-primary w-full">
        {busy ? "送出中…" : "登記資源"}
      </button>
    </form>
  );
}
