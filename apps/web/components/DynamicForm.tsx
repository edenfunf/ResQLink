"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import type { FormField } from "@/lib/types";

/**
 * Renders any generated form artifact (content.fields) as a live, submittable
 * form. Submits to the generic /v1/artifacts/{id}/submissions endpoint.
 */
export default function DynamicForm({
  artifactId,
  title,
  fields,
  notice,
  onSubmitted,
}: {
  artifactId: string;
  title?: string;
  fields: FormField[];
  notice?: string;
  onSubmitted?: () => void;
}) {
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  function set(name: string, v: unknown) {
    setValues((prev) => ({ ...prev, [name]: v }));
  }
  function toggleMulti(name: string, option: string) {
    setValues((prev) => {
      const cur = Array.isArray(prev[name]) ? (prev[name] as string[]) : [];
      return {
        ...prev,
        [name]: cur.includes(option) ? cur.filter((o) => o !== option) : [...cur, option],
      };
    });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    // coerce number fields
    const payload: Record<string, unknown> = {};
    for (const f of fields) {
      const v = values[f.name];
      if (v === undefined || v === "") continue;
      payload[f.name] = f.type === "number" ? Number(v) : v;
    }
    try {
      await api.submitForm(artifactId, payload);
      setDone(true);
      setValues({});
      onSubmitted?.();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="db-card space-y-4 p-5">
      {title ? <h3 className="font-semibold text-stone-900">{title}</h3> : null}
      {notice ? (
        <p className="rounded-lg bg-[#f7e3dc] px-3 py-2 text-xs text-[#8c3b2e]">{notice}</p>
      ) : null}

      {fields.map((f) => {
        const label = f.label || f.name;
        const required = !!f.required;
        const common = "db-input";
        const val = values[f.name];
        return (
          <div key={f.name}>
            <label className="db-label">
              {label}
              {required ? <span className="text-[#8c3b2e]"> *</span> : null}
              {f.pii ? <span className="ml-1 text-[10px] text-stone-400">(個資)</span> : null}
            </label>
            {f.type === "select" ? (
              <select
                className={common}
                required={required}
                value={(val as string) ?? ""}
                onChange={(e) => set(f.name, e.target.value)}
              >
                <option value="">請選擇…</option>
                {(f.options ?? []).map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            ) : f.type === "textarea" ? (
              <textarea
                className={common}
                rows={3}
                required={required}
                value={(val as string) ?? ""}
                onChange={(e) => set(f.name, e.target.value)}
              />
            ) : f.type === "multi_select" ? (
              <div className="mt-1 flex flex-wrap gap-2">
                {(f.options ?? []).map((o) => {
                  const checked = Array.isArray(val) && (val as string[]).includes(o);
                  return (
                    <button
                      type="button"
                      key={o}
                      onClick={() => toggleMulti(f.name, o)}
                      className={`rounded-full px-3 py-1 text-xs ring-1 ring-inset transition ${
                        checked
                          ? "text-stone-50"
                          : "bg-stone-100 text-stone-600 ring-stone-200 hover:bg-stone-200"
                      }`}
                      style={checked ? { background: "#1b1a17" } : undefined}
                    >
                      {o}
                    </button>
                  );
                })}
              </div>
            ) : (
              <input
                className={common}
                type={f.type === "datetime" ? "datetime-local" : "text"}
                inputMode={f.type === "number" ? "numeric" : undefined}
                required={required}
                value={(val as string) ?? ""}
                onChange={(e) => set(f.name, e.target.value)}
              />
            )}
          </div>
        );
      })}

      {error ? (
        <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-inset ring-rose-100">
          {error}
        </p>
      ) : null}
      {done ? (
        <p className="rounded-xl bg-[#e7ebdd] px-3 py-2 text-sm text-[#4f5b3c]">
          已送出，感謝您的回報。
        </p>
      ) : null}

      <button type="submit" disabled={busy} className="db-btn db-btn-primary w-full">
        {busy ? "送出中…" : "送出"}
      </button>
    </form>
  );
}
