"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function SiteTabs({ siteId }: { siteId: string }) {
  const path = usePathname();
  const base = `/app/sites/${siteId}`;
  const tabs = [
    ["", "Overview"],
    ["/tasks", "Action plan"],
    ["/ai", "AI visibility"],
    ["/competitors", "Competitors"],
    ["/settings", "Settings"],
  ] as const;
  return (
    <nav className="-mb-px flex gap-1 overflow-x-auto border-b border-slate-200 text-sm" aria-label="Site sections">
      {tabs.map(([suffix, label]) => {
        const href = base + suffix;
        const active = suffix === "" ? path === base : path.startsWith(href);
        return (
          <Link
            key={suffix}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`whitespace-nowrap border-b-2 px-3 py-2 font-medium ${active ? "border-ink text-ink" : "border-transparent text-slate-500 hover:text-ink"}`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
