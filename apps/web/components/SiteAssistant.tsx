"use client";

// Floating site assistant — ask anything about the ResQLink system.
// Conversational when the backend AI layer is enabled; otherwise the backend
// answers from its built-in knowledge base, so the widget always works.

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";

const STORAGE_KEY = "resqlink.assistant.v1";
const ACCENT = "#8c3b2e";

type Msg = { role: "user" | "assistant"; content: string };

const DEFAULT_SUGGESTIONS = [
  "這個系統是做什麼的？",
  "怎麼從一句話生成救災網站？",
  "審核流程怎麼運作？",
  "民眾通報後系統會做什麼？",
];

/** Minimal formatter: render **bold** segments, keep everything else plain. */
function renderContent(text: string): React.ReactNode {
  const parts = text.split(/\*\*(.+?)\*\*/g);
  if (parts.length === 1) return text;
  return parts.map((p, i) => (i % 2 === 1 ? <b key={i}>{p}</b> : p));
}

const WELCOME: Msg = {
  role: "assistant",
  content:
    "你好，我是災鏈 ResQLink 的網站助手。關於這個系統的任何問題（功能、頁面、操作流程、API）都可以問我。",
};

export default function SiteAssistant() {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([WELCOME]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"ai" | "kb" | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>(DEFAULT_SUGGESTIONS);
  const [ready, setReady] = useState(false);
  const listRef = useRef<HTMLDivElement | null>(null);

  // restore conversation
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) {
        const s = JSON.parse(raw) as { msgs: Msg[]; mode: "ai" | "kb" | null };
        if (s.msgs?.length) setMsgs(s.msgs);
        if (s.mode) setMode(s.mode);
      }
    } catch {
      /* ignore */
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ msgs: msgs.slice(-30), mode }));
    } catch {
      /* ignore */
    }
  }, [ready, msgs, mode]);

  // keep scrolled to the latest message
  useEffect(() => {
    if (open) listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [open, msgs, busy]);

  async function send(text?: string) {
    const q = (text ?? input).trim();
    if (!q || busy) return;
    setInput("");
    const nextMsgs: Msg[] = [...msgs, { role: "user", content: q }];
    setMsgs(nextMsgs);
    setBusy(true);
    try {
      const history = nextMsgs
        .slice(-9, -1) // recent turns, excluding the message itself
        .filter((m) => m !== WELCOME)
        .map((m) => ({ role: m.role, content: m.content }));
      const res = await api.assistantChat(q, history);
      setMode(res.mode);
      if (res.suggestions?.length) setSuggestions(res.suggestions);
      setMsgs((cur) => [...cur, { role: "assistant", content: res.reply }]);
    } catch {
      setMsgs((cur) => [
        ...cur,
        { role: "assistant", content: "抱歉，助手暫時無法回應，請稍後再試。" },
      ]);
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setMsgs([WELCOME]);
    setSuggestions(DEFAULT_SUGGESTIONS);
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }

  const showSuggestions = msgs.length <= 2 && !busy;

  return (
    <>
      {/* floating launcher */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="網站助手"
        className="fixed bottom-5 right-5 z-[1200] flex items-center gap-2 rounded-full px-4 py-3 text-sm font-semibold text-white shadow-lg transition hover:brightness-110"
        style={{ background: "#1b1a17" }}
      >
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M21 12a8 8 0 0 1-8 8H5l-2 2V12a8 8 0 0 1 8-8h2a8 8 0 0 1 8 8Z" />
          <path d="M9 11h.01M13 11h.01M17 11h.01" />
        </svg>
        {open ? "收合助手" : "網站助手"}
      </button>

      {/* panel */}
      {open ? (
        <div
          className="fixed bottom-20 right-5 z-[1200] flex w-[min(400px,calc(100vw-2.5rem))] flex-col overflow-hidden rounded-2xl border shadow-2xl"
          style={{ background: "var(--card)", borderColor: "var(--line)", height: "min(600px, calc(100vh - 8rem))" }}
        >
          {/* header */}
          <div className="flex items-center gap-2.5 border-b px-4 py-3" style={{ borderColor: "var(--line)" }}>
            <span className="grid h-8 w-8 place-items-center rounded-lg text-white" style={{ background: ACCENT }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
                <path d="M12 3v2M5.5 8.5 4 7m14.5 1.5L20 7M12 21a7 7 0 0 0 7-7c0-3.9-3.1-7-7-7s-7 3.1-7 7a7 7 0 0 0 7 7Z" />
                <path d="M9 13h.01M15 13h.01" />
              </svg>
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-stone-900">ResQLink 網站助手</div>
              <div className="text-[11px] text-stone-400">
                {mode === "kb" ? "內建知識庫模式" : "問我任何關於這個系統的事"}
              </div>
            </div>
            {msgs.length > 1 ? (
              <button
                type="button"
                onClick={reset}
                className="text-[11px] text-stone-400 transition hover:text-stone-700"
              >
                清除對話
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="關閉"
              className="grid h-7 w-7 place-items-center rounded-md text-stone-400 transition hover:bg-stone-200/60 hover:text-stone-800"
            >
              ✕
            </button>
          </div>

          {/* messages */}
          <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
            {msgs.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className="max-w-[85%] whitespace-pre-line rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed"
                  style={
                    m.role === "user"
                      ? { background: ACCENT, color: "#f8f4ee", borderBottomRightRadius: 6 }
                      : { background: "#efeae0", color: "#1b1a17", borderBottomLeftRadius: 6 }
                  }
                >
                  {renderContent(m.content)}
                </div>
              </div>
            ))}
            {busy ? (
              <div className="flex justify-start">
                <div className="flex items-center gap-1.5 rounded-2xl bg-[#efeae0] px-4 py-3" style={{ borderBottomLeftRadius: 6 }}>
                  {[0, 1, 2].map((i) => (
                    <span
                      key={i}
                      className="db-genpulse inline-block h-1.5 w-1.5 rounded-full bg-stone-500"
                      style={{ animationDelay: `${i * 0.18}s` }}
                    />
                  ))}
                </div>
              </div>
            ) : null}

            {showSuggestions ? (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => send(s)}
                    className="rounded-full border bg-white px-3 py-1.5 text-[12px] text-stone-600 transition hover:border-stone-400 hover:text-stone-900"
                    style={{ borderColor: "var(--line)" }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          {/* input */}
          <div className="border-t px-3 py-3" style={{ borderColor: "var(--line)" }}>
            <div className="flex items-end gap-2">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    send();
                  }
                }}
                rows={1}
                placeholder="輸入問題，Enter 送出…"
                className="db-input !mt-0 max-h-24 flex-1 resize-none"
              />
              <button
                type="button"
                onClick={() => send()}
                disabled={busy || !input.trim()}
                className="db-btn db-btn-accent shrink-0 !px-3.5"
                aria-label="送出"
              >
                ➤
              </button>
            </div>
            <p className="mt-1.5 text-[10.5px] text-stone-400">
              助手僅回答本系統相關問題；回覆僅供參考，操作以實際頁面為準。
            </p>
          </div>
        </div>
      ) : null}
    </>
  );
}
