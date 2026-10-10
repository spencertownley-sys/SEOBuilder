import { buildActionPlan, computeScores, reconcilePlan, type Issue, type Task, type TaskStatus } from "@seobuilder/core";
import { one, q, type Db } from "./db.js";
import { enqueue } from "./jobs.js";
import { requireSite } from "./sites.js";

export type TaskSource = "audit" | "geo";

export interface TaskRow {
  id: string;
  site_id: string;
  source: TaskSource;
  type: string;
  module: Task["module"];
  severity: Task["severity"];
  title: string;
  why: string;
  steps: string[];
  urls: string[];
  draft_fix: string | null;
  impact: number;
  effort: number;
  confidence: number;
  priority: number;
  status: TaskStatus;
  resolved: boolean;
  updated_at: Date;
}

export function rowToTask(r: TaskRow): Task {
  return {
    id: r.id,
    type: r.type,
    module: r.module,
    severity: r.severity,
    title: r.title,
    why: r.why,
    steps: r.steps,
    urls: r.urls,
    draftFix: r.draft_fix ?? undefined,
    impact: r.impact,
    effort: r.effort,
    confidence: r.confidence,
    priority: r.priority,
    status: r.status,
  };
}

/**
 * Replaces one source's tasks with a fresh set of issues, keeping each task's status (PRD:
 * marking Done triggers a re-check). Tasks whose issue disappeared are marked resolved + done;
 * Done tasks whose issue is still there reopen. Returns the issue types that are new and fixed.
 */
export async function syncTasks(siteId: string, source: TaskSource, siteOrigin: string, issues: Issue[], db: Db): Promise<{ added: string[]; fixed: string[] }> {
  const prevRows = await q<TaskRow>("select * from tasks where site_id = $1 and source = $2", [siteId, source], db);
  const prevOpen = prevRows.filter((r) => !r.resolved);
  const { tasks } = reconcilePlan(prevRows.map(rowToTask), buildActionPlan(siteOrigin, issues));
  const nextIds = new Set(tasks.map((t) => t.id));
  const prevOpenIds = new Set(prevOpen.map((r) => r.id));

  for (const t of tasks) {
    await q(
      `insert into tasks (id, site_id, source, type, module, severity, title, why, steps, urls, draft_fix, impact, effort, confidence, priority, status, resolved, updated_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,false,now())
       on conflict (site_id, id) do update set
         type = excluded.type, module = excluded.module, severity = excluded.severity, title = excluded.title, why = excluded.why,
         steps = excluded.steps, urls = excluded.urls, draft_fix = excluded.draft_fix, impact = excluded.impact, effort = excluded.effort,
         confidence = excluded.confidence, priority = excluded.priority, status = excluded.status, resolved = false,
         updated_at = case when tasks.status is distinct from excluded.status or tasks.resolved then now() else tasks.updated_at end`,
      [t.id, siteId, source, t.type, t.module, t.severity, t.title, t.why, t.steps, t.urls, t.draftFix ?? null, t.impact, t.effort, t.confidence, t.priority, t.status],
      db,
    );
  }
  const fixed = prevOpen.filter((r) => !nextIds.has(r.id));
  if (fixed.length) {
    await q(
      "update tasks set resolved = true, status = case when status = 'ignored' then status else 'done' end, updated_at = now() where site_id = $1 and id = any($2)",
      [siteId, fixed.map((r) => r.id)],
      db,
    );
  }
  return { added: tasks.filter((t) => !prevOpenIds.has(t.id)).map((t) => t.type), fixed: fixed.map((r) => r.type) };
}

interface PromptMetrics {
  overall?: { answers: number; mentionRate: { value: number }; citationRate: { value: number } };
}

/** Records the three scores from open audit tasks plus the latest AI tracking run. */
export async function snapshotScores(siteId: string, db: Db): Promise<void> {
  const open = (await q<TaskRow>("select * from tasks where site_id = $1 and source = 'audit' and not resolved", [siteId], db)).map(rowToTask);
  const run = await one<{ metrics: PromptMetrics }>(
    "select metrics from prompt_runs where site_id = $1 and status = 'done' order by started_at desc limit 1",
    [siteId],
    db,
  );
  const o = run?.metrics?.overall;
  const scores = computeScores(open, o ? { mentionRate: o.mentionRate.value, citationRate: o.citationRate.value, sampleSize: o.answers } : undefined);
  await q("insert into score_snapshots (site_id, technical, search, ai_visibility, ai_readiness) values ($1, $2, $3, $4, $5)", [
    siteId,
    scores.technical,
    scores.search,
    scores.aiVisibility,
    scores.aiReadiness,
  ], db);
}

export async function listTasks(userId: string, siteId: string): Promise<TaskRow[]> {
  const site = await requireSite(userId, siteId);
  return q<TaskRow>(
    `select * from tasks where site_id = $1
      order by resolved, case status when 'in_progress' then 0 when 'todo' then 1 when 'done' then 2 else 3 end, priority desc`,
    [site.id],
  );
}

/** Status change from the task list. Marking Done queues a re-check of the site (PRD workflow P0). */
export async function setTaskStatus(userId: string, siteId: string, taskId: string, status: TaskStatus): Promise<{ recheckQueued: boolean }> {
  const site = await requireSite(userId, siteId);
  if (!["todo", "in_progress", "done", "ignored"].includes(status)) throw new Error("Bad status");
  const row = await one<TaskRow>("update tasks set status = $3, updated_at = now() where site_id = $1 and id = $2 returning *", [site.id, taskId, status]);
  if (!row) throw new Error("Task not found");
  if (status !== "done" || row.resolved) return { recheckQueued: false };
  const kind = row.source === "audit" ? "site_crawl" : "prompt_run";
  if (kind === "prompt_run") return { recheckQueued: false }; // AI answers are re-checked on the next scheduled run
  const pending = await one("select 1 from jobs where kind = 'site_crawl' and status in ('queued','running') and payload->>'siteId' = $1", [site.id]);
  // Short delay so several tasks marked Done in a row share one re-crawl.
  if (!pending) await enqueue("site_crawl", { siteId: site.id, reason: "recheck" }, { delaySeconds: 60 });
  return { recheckQueued: true };
}
