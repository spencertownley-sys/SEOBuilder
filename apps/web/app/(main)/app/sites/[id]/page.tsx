import Link from "next/link";
import { listTasks, rowToTask, siteOverview } from "@seobuilder/platform";
import { AutoRefresh } from "@/components/auto-refresh";
import { Messages } from "@/components/messages";
import { ScoreCard, TaskCard } from "@/components/report";
import { ScoreChart } from "@/components/score-chart";
import { SubmitButton } from "@/components/submit-button";
import { timeAgo } from "@/lib/format";
import { requireUser } from "@/lib/session";
import { recrawlAction, setTaskStatusAction } from "@/app/actions";

const label = (t: string) => t.replace(/-/g, " ");

export default async function Overview({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ notice?: string; error?: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const { notice, error } = await searchParams;
  const [ov, tasks] = await Promise.all([siteOverview(user.id, id), listTasks(user.id, id)]);
  const { site, scores, lastCrawl, crawlJob } = ov;
  const latest = scores.at(-1);
  const prev = scores.at(-2);
  const delta = (k: "technical" | "ai_visibility") => (latest && prev ? latest[k] - prev[k] : null);
  const open = tasks.filter((t) => !t.resolved && (t.status === "todo" || t.status === "in_progress"));
  const busy = !!crawlJob;

  return (
    <div className="space-y-8">
      {busy && <AutoRefresh ms={3000} />}
      <Messages notice={notice} error={error} />

      <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-5 py-4 text-sm">
        <div>
          {busy ? (
            <p className="font-medium">
              <span className="mr-2 inline-block h-2 w-2 animate-pulse rounded-full bg-accent" />
              {crawlJob.status === "running" ? (crawlJob.progress ?? "Crawling…") : new Date(crawlJob.run_after) > new Date() ? `Re-check starts ${timeAgo(crawlJob.run_after)}` : "Crawl queued…"}
            </p>
          ) : lastCrawl?.status === "failed" ? (
            <p className="text-rose-700">Last crawl failed {timeAgo(lastCrawl.finished_at)}: {lastCrawl.error}</p>
          ) : lastCrawl ? (
            <p>
              Last crawled {timeAgo(lastCrawl.finished_at)} · {lastCrawl.pages_crawled} pages · next automatic crawl {timeAgo(site.next_crawl_at)}
            </p>
          ) : (
            <p>First crawl starting…</p>
          )}
          {lastCrawl?.status === "done" && (lastCrawl.new_issues.length > 0 || lastCrawl.fixed_issues.length > 0) && (
            <p className="mt-1 text-slate-600">
              {lastCrawl.fixed_issues.length > 0 && <span className="text-emerald-700">Fixed: {lastCrawl.fixed_issues.map(label).join(", ")}. </span>}
              {lastCrawl.new_issues.length > 0 && <span>New: {lastCrawl.new_issues.map(label).join(", ")}.</span>}
            </p>
          )}
        </div>
        {!busy && (
          <form action={recrawlAction.bind(null, site.id)}>
            <SubmitButton variant="secondary" pending="Queuing…">
              Re-crawl now
            </SubmitButton>
          </form>
        )}
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        <ScoreCard label="Technical Health" value={latest?.technical ?? null} delta={delta("technical")} note="Crawlability, on-page basics, speed." />
        <ScoreCard label="Search Visibility" value={latest?.search ?? null} note="Needs rank data: Search Console and keyword tracking are next on the roadmap." />
        <ScoreCard
          label="AI Visibility"
          value={latest?.ai_visibility ?? null}
          delta={delta("ai_visibility")}
          note={ov.promptRun?.status === "done" ? "Blends on-site readiness with what AI answers actually say." : "On-site readiness until AI answer tracking runs."}
        />
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="mb-3 font-semibold">Score history</h2>
        <ScoreChart points={scores.map((s) => ({ t: new Date(s.taken_at).toISOString(), technical: s.technical, ai: s.ai_visibility, search: s.search }))} />
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-xl font-bold">Next best fixes</h2>
          <Link href={`/app/sites/${site.id}/tasks`} className="text-sm font-medium text-accent">
            Full action plan ({open.length} open) →
          </Link>
        </div>
        {open.length === 0 ? (
          <p className="text-sm text-slate-600">{lastCrawl ? "Nothing open. Nice work." : "Your action plan appears after the first crawl."}</p>
        ) : (
          <ol className="space-y-3">
            {open.slice(0, 5).map((t, i) => (
              <TaskCard key={t.id} task={rowToTask(t)} rank={i + 1} statusAction={setTaskStatusAction.bind(null, site.id, `/app/sites/${site.id}`)} />
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
