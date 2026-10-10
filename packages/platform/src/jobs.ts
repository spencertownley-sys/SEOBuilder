// Postgres-backed job queue (FOR UPDATE SKIP LOCKED) plus the scheduler for weekly re-crawls
// and prompt runs. Runs inside the web process; several processes can share the queue safely.

import { availableEngines } from "@seobuilder/core";
import { one, q } from "./db.js";

export type JobKind = "public_audit" | "site_crawl" | "prompt_run" | "competitor_audit";

export interface JobRow {
  id: string;
  kind: JobKind;
  payload: Record<string, string>;
  status: "queued" | "running" | "done" | "failed";
  attempts: number;
  progress: string | null;
  result: unknown;
  error: string | null;
  created_at: Date;
  finished_at: Date | null;
  run_after: Date;
}

const MAX_ATTEMPTS = 2;
const STALE_MINUTES = 20;

export async function enqueue(kind: JobKind, payload: Record<string, string>, opts: { delaySeconds?: number; requesterHash?: string } = {}): Promise<string> {
  const row = await one<{ id: string }>(
    "insert into jobs (kind, payload, run_after, requester_hash) values ($1, $2, now() + make_interval(secs => $3), $4) returning id",
    [kind, JSON.stringify(payload), opts.delaySeconds ?? 0, opts.requesterHash ?? null],
  );
  return row!.id;
}

export async function getJob(id: string): Promise<JobRow | undefined> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return undefined;
  return one<JobRow>("select * from jobs where id = $1", [id]);
}

export async function claimJob(): Promise<JobRow | undefined> {
  return one<JobRow>(
    `update jobs set status = 'running', locked_at = now(), attempts = attempts + 1
      where id = (select id from jobs where status = 'queued' and run_after <= now()
                   order by (kind = 'public_audit') desc, run_after for update skip locked limit 1)
      returning *`,
  );
}

/** Jobs left running by a process that died go back to the queue (or fail after MAX_ATTEMPTS). */
export async function recoverStaleJobs(): Promise<void> {
  await q(
    `update jobs set status = case when attempts >= $1 then 'failed' else 'queued' end,
                     error = case when attempts >= $1 then 'Worker stopped while running this job' else error end,
                     finished_at = case when attempts >= $1 then now() else null end
      where status = 'running' and locked_at < now() - make_interval(mins => $2)`,
    [MAX_ATTEMPTS, STALE_MINUTES],
  );
}

export type Handler = (job: JobRow, progress: (msg: string) => void) => Promise<unknown>;

async function runOne(job: JobRow, handlers: Record<JobKind, Handler>): Promise<void> {
  let last = 0;
  const progress = (msg: string) => {
    const now = Date.now();
    if (now - last < 1500) return;
    last = now;
    q("update jobs set progress = $2, locked_at = now() where id = $1", [job.id, msg]).catch(() => {});
  };
  try {
    const result = await handlers[job.kind](job, progress);
    await q("update jobs set status = 'done', finished_at = now(), result = $2, progress = null where id = $1", [job.id, JSON.stringify(result ?? null)]);
  } catch (e) {
    const msg = (e as Error).message?.slice(0, 500) ?? String(e);
    console.error(`[jobs] ${job.kind} ${job.id} failed:`, msg);
    await q("update jobs set status = 'failed', finished_at = now(), error = $2 where id = $1", [job.id, msg]);
  }
}

/** Enqueues weekly re-crawls and AI prompt runs that are due. */
export async function scheduleDue(): Promise<void> {
  // Bump next_crawl_at in the same statement so two schedulers can't both enqueue a site.
  const due = await q<{ id: string }>(
    `update sites set next_crawl_at = now() + interval '7 days'
      where next_crawl_at <= now()
        and not exists (select 1 from jobs j where j.kind = 'site_crawl' and j.status in ('queued','running') and j.payload->>'siteId' = sites.id::text)
      returning id`,
  );
  for (const s of due) await enqueue("site_crawl", { siteId: s.id, reason: "scheduled" });

  if (availableEngines().length) {
    const prompts = await q<{ id: string }>(
      `update sites set next_prompt_run_at = now() + interval '7 days'
        where (next_prompt_run_at is null or next_prompt_run_at <= now())
          and exists (select 1 from prompts p where p.site_id = sites.id and p.active)
        returning id`,
    );
    for (const s of prompts) await enqueue("prompt_run", { siteId: s.id });
  }
}

const g = globalThis as unknown as { __seobuilderWorker?: { stop: () => void } };

/** Starts the in-process worker once per process. */
export function startWorker(handlers: Record<JobKind, Handler>, opts: { concurrency?: number; pollMs?: number } = {}): { stop: () => void } {
  if (g.__seobuilderWorker) return g.__seobuilderWorker;
  const { concurrency = 2, pollMs = 1000 } = opts;
  let stopped = false;
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  async function loop() {
    while (!stopped) {
      try {
        const job = await claimJob();
        if (job) await runOne(job, handlers);
        else await sleep(pollMs);
      } catch (e) {
        console.error("[jobs] worker error", e);
        await sleep(5000);
      }
    }
  }
  async function scheduler() {
    while (!stopped) {
      try {
        await recoverStaleJobs();
        await scheduleDue();
      } catch (e) {
        console.error("[jobs] scheduler error", e);
      }
      await sleep(60_000);
    }
  }
  for (let i = 0; i < concurrency; i++) void loop();
  void scheduler();
  g.__seobuilderWorker = {
    stop: () => {
      stopped = true;
      g.__seobuilderWorker = undefined;
    },
  };
  return g.__seobuilderWorker;
}
