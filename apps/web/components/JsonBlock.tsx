"use client";

import { useState } from "react";

export default function JsonBlock({
  data,
  label = "JSON",
  collapsed = true,
}: {
  data: unknown;
  label?: string;
  collapsed?: boolean;
}) {
  const [open, setOpen] = useState(!collapsed);
  const text = JSON.stringify(data, null, 2);

  return (
    <div className="overflow-hidden rounded-xl border border-stone-200 bg-stone-50/60">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-3 py-2 text-left text-xs font-medium text-stone-500 transition hover:text-stone-900"
      >
        <span className="inline-flex items-center gap-1.5">
          <span className="font-mono text-stone-400">{"{ }"}</span>
          {label}
        </span>
        <span className="text-stone-400">{open ? "收合" : "展開"}</span>
      </button>
      {open ? (
        <pre className="max-h-72 overflow-auto border-t border-stone-200 bg-stone-900 px-3 py-2.5 text-[11.5px] leading-relaxed text-stone-200">
          {text}
        </pre>
      ) : null}
    </div>
  );
}
