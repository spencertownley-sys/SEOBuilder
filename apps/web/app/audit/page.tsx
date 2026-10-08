import { runAudit, type Task } from "@seobuilder/core";
import { AuditForm } from "../audit-form";

export const maxDuration = 300;

// PRD pricing: the free audit covers one site, a capped crawl, and the top 10 fixes.
const FREE_PAGE_LIMIT = 50;
const FREE_FIX_LIMIT = 10;

function normalizeUrl(raw: string): string | null {
  try {
    const u = new URL(/^https?:\/\//i.test(raw.trim()) ? raw.trim() : `https://${raw.trim()}`);
    return u.hostname.includes(".") ? u.toString() : null;
  } catch {
    return null;
  }
}

function ScoreCard({ label, value, note }: { label: string; value: number | null; note: string }) {
  const tone = value === null ? "text-slate-400" : value >= 80 ? "text-emerald-600" : value >= 50 ? "text-amber-600" : "text-rose-600";
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className={`mt-1 text-4xl font-bold ${tone}`}>
        {value ?? "—"}
        {value !== null && <span className="text-lg font-medium text-slate-400">/100</span>}
      </p>
      <p className="mt-2 text-xs text-slate-500">{note}</p>
    </div>
  );
}

const MODULE_LABEL = { seo: "SEO", geo: "AI", both: "SEO + AI" } as const;

function TaskCard({ task, rank }: { task: Task; rank: number }) {
  return (
    <li className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex items-start gap-4">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ink text-sm font-semibold text-white">{rank}</span>
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold">{task.title}</h3>
            <span className="rounded-full bg-teal-50 px-2 py-0.5 text-xs font-medium text-accent">{MODULE_LABEL[task.module]}</span>
            {task.severity === "critical" && <span className="rounded-full bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-700">Critical</span>}
          </div>
          <p className="text-sm text-slate-600">{task.why}</p>
          <p className="text-xs text-slate-500">
            Est. impact {task.impact}/5 · effort {task.effort}/5
          </p>
          <details className="text-sm">
            <summary className="cursor-pointer font-medium text-accent">How to fix it</summary>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-slate-700">
              {task.steps.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ol>
            {task.urls.length > 0 && (
              <div className="mt-3">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Affected</p>
                <ul className="mt-1 space-y-0.5 text-xs">
                  {task.urls.slice(0, 8).map((u) => (
                    <li key={u} className="truncate">
                      <a href={u} className="text-slate-600 underline decoration-slate-300 hover:text-ink" rel="nofollow noopener" target="_blank">
                        {u}
                      </a>
                    </li>
                  ))}
                  {task.urls.length > 8 && <li className="text-slate-400">+{task.urls.length - 8} more</li>}
                </ul>
              </div>
            )}
            {task.draftFix && (
              <div className="mt-3">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Drafted fix</p>
                <pre className="mt-1 overflow-x-auto rounded-lg bg-slate-900 p-3 text-xs text-slate-100">{task.draftFix}</pre>
              </div>
            )}
          </details>
        </div>
      </div>
    </li>
  );
}

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ url?: string }> }) {
  const { url: raw = "" } = await searchParams;
  const url = normalizeUrl(raw);
  if (!url) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Enter a website to audit</h1>
        <AuditForm defaultUrl={raw} />
      </div>
    );
  }

  const result = await runAudit(url, { maxPages: FREE_PAGE_LIMIT, concurrency: 4, delayMs: 200 });
  const { site, scores, tasks } = result;
  const reachable = site.pages.some((p) => p.statusCode >= 200 && p.statusCode < 300);
  if (!reachable) {
    const err = site.pages[0]?.fetchError ?? `HTTP ${site.pages[0]?.statusCode ?? "error"}`;
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">We couldn&apos;t load {new URL(url).hostname}</h1>
        <p className="text-slate-600">{err}. Check the address and try again.</p>
        <AuditForm defaultUrl={raw} />
      </div>
    );
  }
  const blockedBots = Object.entries(site.robots.aiBots).filter(([, b]) => b).map(([bot]) => bot);

  return (
    <div className="space-y-10">
      <section className="space-y-2">
        <p className="text-sm text-slate-500">
          Audited {site.pages.length} page{site.pages.length === 1 ? "" : "s"}
          {site.truncated ? ` (free limit ${FREE_PAGE_LIMIT})` : ""} · {new Date(site.crawledAt).toUTCString()}
        </p>
        <h1 className="break-all text-3xl font-bold">{new URL(site.startUrl).host}</h1>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        <ScoreCard label="Technical Health" value={scores.technical} note="Crawlability, on-page basics, speed." />
        <ScoreCard label="Search Visibility" value={scores.search} note="Connect Search Console to measure rankings and clicks." />
        <ScoreCard
          label="AI Visibility"
          value={scores.aiVisibility}
          note="On-site AI readiness. Prompt tracking adds what ChatGPT, Claude, Gemini and Perplexity actually say."
        />
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 text-sm">
        <h2 className="font-semibold">AI crawler access</h2>
        <p className="mt-1 text-slate-600">
          {site.robots.found ? (
            blockedBots.length ? (
              <>robots.txt blocks: <span className="font-medium text-rose-700">{blockedBots.join(", ")}</span></>
            ) : (
              "robots.txt allows all major AI crawlers."
            )
          ) : (
            "No robots.txt found, so AI crawlers are allowed by default."
          )}{" "}
          A CDN or firewall can still block them; check its bot settings too.
        </p>
      </section>

      <section className="space-y-4">
        <div className="flex items-baseline justify-between">
          <h2 className="text-2xl font-bold">Your top {Math.min(FREE_FIX_LIMIT, tasks.length)} fixes</h2>
          <span className="text-sm text-slate-500">Highest impact for the least effort first</span>
        </div>
        {tasks.length === 0 ? (
          <p className="text-slate-600">No issues found. Nice work.</p>
        ) : (
          <ol className="space-y-3">
            {tasks.slice(0, FREE_FIX_LIMIT).map((t, i) => (
              <TaskCard key={t.id} task={t} rank={i + 1} />
            ))}
          </ol>
        )}
        {tasks.length > FREE_FIX_LIMIT && (
          <p className="text-sm text-slate-500">
            +{tasks.length - FREE_FIX_LIMIT} more tasks in the full action plan.
          </p>
        )}
        <p className="text-xs text-slate-400">Impact and effort are estimates, not guarantees of rankings or AI citations.</p>
      </section>

      <AuditForm defaultUrl={raw} />
    </div>
  );
}
