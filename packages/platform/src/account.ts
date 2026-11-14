// Self-service data rights: download everything an account holds, or delete it all (SB-20).

import { AuthError, normalizeEmail } from "./auth.js";
import { one, q, tx } from "./db.js";

/** Everything stored for this account, as plain JSON (sites, business details, prompts, AI answers, tasks). */
export async function exportAccountData(userId: string): Promise<Record<string, unknown>> {
  const user = await one<{ id: string; email: string; created_at: Date; email_verified_at: Date | null }>(
    "select id, email, created_at, email_verified_at from users where id = $1",
    [userId],
  );
  if (!user) throw new AuthError("No such account.", "auth_failed");
  const workspaces = await q<{ id: string; name: string; plan: string; role: string; created_at: Date }>(
    "select w.id, w.name, w.plan, m.role, w.created_at from workspaces w join workspace_members m on m.workspace_id = w.id where m.user_id = $1 order by w.created_at",
    [userId],
  );
  const wsIds = workspaces.map((w) => w.id);
  const sites = await q<Record<string, unknown> & { id: string }>(
    `select id, workspace_id, url, domain, name, aliases, verified_at, business_kind, business_type, services, locations, brand_facts, created_at
       from sites where workspace_id = any($1) order by created_at`,
    [wsIds],
  );
  const siteIds = sites.map((s) => s.id);
  const [competitors, prompts, promptRuns, answers, mentions, tasks, scores] = await Promise.all([
    q("select site_id, name, domain, aliases, scores, audited_at from competitors where site_id = any($1) order by site_id, name", [siteIds]),
    q("select site_id, text, intent, location, active, created_at from prompts where site_id = any($1) order by site_id, created_at", [siteIds]),
    q("select id, site_id, started_at, finished_at, status, engines, metrics from prompt_runs where site_id = any($1) order by started_at", [siteIds]),
    q(
      `select a.id, r.site_id, a.prompt_run_id, a.prompt_text, a.engine, a.model, a.run_at, a.answer_text, a.cited_urls
         from ai_runs a join prompt_runs r on r.id = a.prompt_run_id where r.site_id = any($1) order by a.run_at`,
      [siteIds],
    ),
    q(
      `select m.ai_run_id, m.entity, m.is_brand, m.mentioned, m.position, m.cited_urls, m.sentiment, m.fact_errors
         from ai_mentions m join ai_runs a on a.id = m.ai_run_id join prompt_runs r on r.id = a.prompt_run_id where r.site_id = any($1)`,
      [siteIds],
    ),
    q("select site_id, id, source, type, title, status, resolved, urls, updated_at from tasks where site_id = any($1) order by site_id, priority desc", [siteIds]),
    q("select site_id, taken_at, technical, search, ai_visibility, ai_readiness from score_snapshots where site_id = any($1) order by site_id, taken_at", [siteIds]),
  ]);
  return {
    exportedAt: new Date().toISOString(),
    account: { email: user.email, createdAt: user.created_at, emailVerifiedAt: user.email_verified_at },
    workspaces,
    sites,
    competitors,
    prompts,
    promptRuns,
    aiAnswers: answers,
    aiMentions: mentions,
    tasks,
    scoreHistory: scores,
  };
}

/**
 * Deletes the account in one transaction: workspaces nobody else belongs to (cascading to sites,
 * crawls, prompts, AI answers, tasks and scores), queued jobs for those sites, the user row
 * (cascading to sessions, memberships and email tokens) and its login-attempt counters.
 */
export async function deleteAccount(userId: string): Promise<void> {
  await tx(async (c) => {
    const user = await one<{ email: string }>("select email from users where id = $1 for update", [userId], c);
    if (!user) return;
    const owned = await q<{ id: string }>(
      `select m.workspace_id as id from workspace_members m
        where m.user_id = $1
          and not exists (select 1 from workspace_members o where o.workspace_id = m.workspace_id and o.user_id <> $1)`,
      [userId],
      c,
    );
    const wsIds = owned.map((w) => w.id);
    const siteIds = (await q<{ id: string }>("select id from sites where workspace_id = any($1)", [wsIds], c)).map((s) => s.id);
    const compIds = (await q<{ id: string }>("select id from competitors where site_id = any($1)", [siteIds], c)).map((x) => x.id);
    await q(
      "delete from jobs where status in ('queued', 'running') and (payload->>'siteId' = any($1) or payload->>'competitorId' = any($2))",
      [siteIds, compIds],
      c,
    );
    await q("delete from workspaces where id = any($1)", [wsIds], c);
    await q("delete from users where id = $1", [userId], c);
    const email = normalizeEmail(user.email);
    await q("delete from auth_attempts where key = any($1)", [[`email:${email}`, `reset:${email}`, `verify:${userId}`]], c);
  });
}
