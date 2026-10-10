import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPublicReport } from "@seobuilder/platform";
import { AutoRefresh } from "@/components/auto-refresh";
import { ScoreCard, TaskCard } from "@/components/report";
import { AuditForm } from "@/components/audit-form";

const FREE_FIX_LIMIT = 10;

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const report = await getPublicReport((await params).id);
  const host = report ? new URL(report.url).host : "Site";
  return { title: `${host} audit`, robots: { index: false } };
}

export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const report = await getPublicReport(id);
  if (!report) notFound();
  const host = new URL(report.url).host;

  if (report.state === "queued" || report.state === "running") {
    return (
      <div className="space-y-3 py-16 text-center">
        <AutoRefresh />
        <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-accent" />
        <p className="text-lg font-medium">{report.state === "queued" ? `Queued${report.position && report.position > 1 ? ` (#${report.position})` : ""}…` : `Auditing ${host}…`}</p>
        <p className="text-sm text-slate-500">{report.progress ?? "Checking pages, robots.txt, AI crawler access, structured data and speed. This takes a minute or two."}</p>
        <p className="text-xs text-slate-400">You can leave this page open, or bookmark it and come back.</p>
      </div>
    );
  }

  const done = report.state === "done" ? report : null;
  if (!done || done.result.error) {
    const err = report.state === "failed" ? report.error : (done?.result.error ?? "The audit failed");
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">We couldn&apos;t audit {host}</h1>
        <p className="text-slate-600">{err}. Check the address and try again.</p>
        <AuditForm defaultUrl={report.url} />
      </div>
    );
  }

  const { result } = done;
  const { scores, tasks, robots } = result;
  const blockedBots = Object.entries(robots.aiBots).filter(([, b]) => b).map(([bot]) => bot);

  return (
    <div className="space-y-10">
      <section className="space-y-2">
        <p className="text-sm text-slate-500">
          Audited {result.pagesCrawled} page{result.pagesCrawled === 1 ? "" : "s"}
          {result.truncated ? " (free audit limit)" : ""} · {new Date(result.crawledAt).toUTCString()}
        </p>
        <h1 className="break-words text-3xl font-bold">{result.host}</h1>
        <p className="text-sm text-slate-500">Share this report: anyone with the link can see it.</p>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        <ScoreCard label="Technical Health" value={scores.technical} note="Crawlability, on-page basics, speed." />
        <ScoreCard label="Search Visibility" value={scores.search} note="Measured from rankings and clicks once Search Console is connected." />
        <ScoreCard label="AI Visibility" value={scores.aiVisibility} note="On-site AI readiness. Saved sites add what AI assistants actually say about you." />
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 text-sm">
        <h2 className="font-semibold">AI crawler access</h2>
        <p className="mt-1 text-slate-600">
          {robots.found
            ? blockedBots.length
              ? <>robots.txt blocks: <span className="font-medium text-rose-700">{blockedBots.join(", ")}</span>.</>
              : "robots.txt allows all major AI crawlers."
            : "No robots.txt found, so AI crawlers are allowed by default."}{" "}
          A CDN or firewall can still block them; check its bot settings too.
        </p>
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
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
      </section>

      <section className="rounded-xl border border-teal-200 bg-teal-50 p-6">
        <h2 className="text-lg font-bold">
          {tasks.length > FREE_FIX_LIMIT ? `+${tasks.length - FREE_FIX_LIMIT} more tasks in the full action plan` : "Keep these scores moving"}
        </h2>
        <p className="mt-1 text-sm text-slate-700">
          Save {result.host} to get the full plan, weekly re-crawls, automatic re-checks when you mark a fix done, competitor comparison and AI answer tracking.
        </p>
        <Link href="/signup" className="mt-3 inline-block rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white hover:bg-ink/90">
          Save this site, free
        </Link>
      </section>

      <AuditForm />
    </div>
  );
}
