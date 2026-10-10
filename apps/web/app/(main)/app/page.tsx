import Link from "next/link";
import { listSites } from "@seobuilder/platform";
import { AutoRefresh } from "@/components/auto-refresh";
import { Messages } from "@/components/messages";
import { scoreTone } from "@/components/report";
import { timeAgo } from "@/lib/format";
import { requireUser } from "@/lib/session";

export const metadata = { title: "Your sites" };

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ notice?: string; error?: string }> }) {
  const user = await requireUser();
  const sites = await listSites(user.id);
  const { notice, error } = await searchParams;
  return (
    <div className="space-y-6">
      {sites.some((s) => s.crawling) && <AutoRefresh ms={4000} />}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold">Your sites</h1>
        <Link href="/app/new" className="rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white hover:bg-ink/90">
          Add a site
        </Link>
      </div>
      <Messages notice={notice} error={error} />
      {sites.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <p className="text-lg font-medium">Add your first site</p>
          <p className="mt-1 text-sm text-slate-500">We&apos;ll crawl it, score it, and build your action plan.</p>
          <Link href="/app/new" className="mt-4 inline-block rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white">
            Add a site
          </Link>
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {sites.map((s) => (
            <li key={s.id}>
              <Link href={`/app/sites/${s.id}`} className="block rounded-xl border border-slate-200 bg-white p-5 hover:border-slate-300 hover:shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{s.name}</p>
                    <p className="truncate text-sm text-slate-500">{s.domain}</p>
                  </div>
                  {s.verified_at && <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">Verified</span>}
                </div>
                <div className="mt-4 flex gap-6">
                  <div>
                    <p className="text-xs text-slate-500">Technical</p>
                    <p className={`text-2xl font-bold ${scoreTone(s.technical)}`}>{s.technical ?? "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">AI Visibility</p>
                    <p className={`text-2xl font-bold ${scoreTone(s.ai_visibility)}`}>{s.ai_visibility ?? "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Open tasks</p>
                    <p className="text-2xl font-bold">{s.open_tasks}</p>
                  </div>
                </div>
                <p className="mt-3 text-xs text-slate-500">{s.crawling ? "Crawling now…" : `Last crawled ${timeAgo(s.last_crawl)}`}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
