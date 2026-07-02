"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import SiteAssistant from "./SiteAssistant";

const NAV = [
  { href: "/console", label: "管理台" },
  { href: "/console/agent", label: "AI 編排" },
  { href: "/console/modules", label: "模組目錄" },
  { href: "/console/connectors", label: "開放資料" },
  { href: "/console/new", label: "建立事件" },
  { href: "/console/reviews", label: "審核" },
];

function BrandMark() {
  return (
    <span
      className="grid h-8 w-8 place-items-center rounded-md"
      style={{ background: "#1b1a17" }}
    >
      <svg width="17" height="17" viewBox="0 0 18 18" fill="none" aria-hidden>
        <rect x="1" y="1" width="7" height="7" rx="1.4" fill="#c5705f" />
        <rect x="10" y="1" width="7" height="7" rx="1.4" fill="#f4f1ec" />
        <rect x="1" y="10" width="7" height="7" rx="1.4" fill="#f4f1ec" />
        <rect x="10" y="10" width="7" height="7" rx="1.4" fill="#8c3b2e" />
      </svg>
    </span>
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  function isActive(href: string) {
    if (href === "/console") return pathname === "/console";
    return pathname.startsWith(href);
  }

  return (
    <div className="min-h-screen">
      <header
        className="sticky top-0 z-20 border-b backdrop-blur-md"
        style={{ borderColor: "#e7e1d7", background: "rgba(244,241,236,0.8)" }}
      >
        <div className="mx-auto flex max-w-[1400px] items-center justify-between px-4 py-3">
          <Link href="/" className="group flex items-center gap-2.5">
            <BrandMark />
            <span className="flex flex-col leading-none">
              <span className="font-display text-[16px] font-semibold tracking-tight text-stone-900">
                災鏈 ResQLink
              </span>
              <span className="mt-1 text-[10.5px] uppercase tracking-[0.18em] text-stone-400">
                防災積木元件
              </span>
            </span>
          </Link>

          <nav className="flex items-center gap-1 text-sm">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-lg px-3 py-1.5 transition ${
                  isActive(item.href)
                    ? "text-stone-50"
                    : "text-stone-500 hover:bg-stone-200/50 hover:text-stone-900"
                }`}
                style={isActive(item.href) ? { background: "#1b1a17" } : undefined}
              >
                {item.label}
              </Link>
            ))}
            <span className="mx-1 hidden h-5 w-px bg-stone-300/70 sm:block" />
            <a
              href="http://localhost:8000/docs"
              target="_blank"
              rel="noreferrer"
              className="hidden rounded-lg px-3 py-1.5 text-stone-400 transition hover:bg-stone-200/50 hover:text-stone-900 sm:inline"
            >
              API ↗
            </a>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-[1400px] px-4 py-8">{children}</main>

      <footer className="mx-auto max-w-[1400px] px-4 pb-10 pt-4">
        <div className="db-divider mb-4" />
        <p className="text-xs text-stone-400">
          災鏈 ResQLink — 公民科技輔助工具，不取代官方災害應變指揮與公告。
        </p>
      </footer>

      <SiteAssistant />
    </div>
  );
}
