import AppShell from "@/components/AppShell";
import AgentChat from "@/components/AgentChat";

export const metadata = {
  title: "AI 編排 · 災鏈 ResQLink",
};

export default function AgentConsolePage() {
  return (
    <AppShell>
      <div className="mx-auto max-w-3xl">
        <span className="db-eyebrow block">Agent Orchestrator</span>
        <h1 className="font-display mt-1 text-2xl font-semibold tracking-tight text-stone-900">
          對話式救災編排
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-stone-500">
          用一句話描述災害，Agent 會標準化成事件、從模組目錄提案救災元件，
          由你確認後平行生成。產出一律進人工審核閘門。
        </p>
        <div className="mt-6">
          <AgentChat />
        </div>
      </div>
    </AppShell>
  );
}
