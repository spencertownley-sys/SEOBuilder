import { auditCompetitor, crawlSavedSite, runPublicAudit } from "./audits.js";
import { executePromptRun } from "./geo.js";
import { startWorker, type Handler, type JobKind } from "./jobs.js";

export * from "./db.js";
export * from "./migrate.js";
export * from "./auth.js";
export * from "./sites.js";
export * from "./tasks.js";
export * from "./audits.js";
export * from "./geo.js";
export * from "./jobs.js";
export * from "./public.js";

export const HANDLERS: Record<JobKind, Handler> = {
  public_audit: (job, progress) => runPublicAudit(job.payload.url!, progress),
  site_crawl: (job, progress) => crawlSavedSite(job.payload.siteId!, progress),
  competitor_audit: (job) => auditCompetitor(job.payload.competitorId!),
  prompt_run: (job, progress) => executePromptRun(job.payload.siteId!, job.payload.promptRunId, progress),
};

export function startBackgroundWorker(concurrency = Number(process.env.WORKER_CONCURRENCY ?? 2)) {
  return startWorker(HANDLERS, { concurrency });
}
