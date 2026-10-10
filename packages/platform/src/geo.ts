import { allEngines, availableEngines, trackVisibility, type Engine, type Intent, type TrackedPrompt } from "@seobuilder/core";
import { one, q, tx } from "./db.js";
import { enqueue } from "./jobs.js";
import { brandProfile, InputError, requireSite, seedPrompts } from "./sites.js";
import { snapshotScores, syncTasks } from "./tasks.js";

export const MAX_PROMPTS_PER_RUN = Number(process.env.MAX_PROMPTS_PER_RUN ?? 25);
export const PROMPT_RUN_DAYS = 7;

const INTENTS: Intent[] = ["discovery", "comparison", "how-to", "pricing", "brand"];

export interface PromptRow {
  id: string;
  text: string;
  intent: Intent;
  location: string | null;
  active: boolean;
}

export function engineStatus(): { id: string; model: string; available: boolean; envVar: string }[] {
  const env: Record<string, string> = { chatgpt: "OPENAI_API_KEY", claude: "ANTHROPIC_API_KEY", gemini: "GEMINI_API_KEY", perplexity: "PERPLEXITY_API_KEY" };
  return allEngines().map((e) => ({ id: e.id, model: e.model, available: e.available(), envVar: env[e.id]! }));
}

export async function listPrompts(userId: string, siteId: string): Promise<PromptRow[]> {
  const site = await requireSite(userId, siteId);
  return q<PromptRow>("select id, text, intent, location, active from prompts where site_id = $1 order by active desc, intent, created_at", [site.id]);
}

export async function addPrompt(userId: string, siteId: string, text: string, intent: string): Promise<void> {
  const site = await requireSite(userId, siteId);
  const t = text.trim();
  if (t.length < 3 || t.length > 300) throw new InputError("Prompts should be 3–300 characters.");
  if (!INTENTS.includes(intent as Intent)) throw new InputError("Pick an intent.");
  const n = await one<{ n: number }>("select count(*)::int as n from prompts where site_id = $1", [site.id]);
  if ((n?.n ?? 0) >= 100) throw new InputError("A site can have up to 100 prompts.");
  await q("insert into prompts (site_id, text, intent) values ($1, $2, $3) on conflict (site_id, text) do update set active = true", [site.id, t, intent]);
}

export async function setPromptActive(userId: string, siteId: string, promptId: string, active: boolean): Promise<void> {
  const site = await requireSite(userId, siteId);
  await q("update prompts set active = $3 where id = $2 and site_id = $1", [site.id, promptId, active]);
}

export async function deletePrompt(userId: string, siteId: string, promptId: string): Promise<void> {
  const site = await requireSite(userId, siteId);
  await q("delete from prompts where id = $2 and site_id = $1", [site.id, promptId]);
}

export async function suggestMorePrompts(userId: string, siteId: string): Promise<number> {
  const site = await requireSite(userId, siteId);
  return seedPrompts(site.id, undefined, 50);
}

/** Queues a tracking run now. Returns null when no engine has an API key configured. */
export async function requestPromptRun(userId: string, siteId: string): Promise<string | null> {
  const site = await requireSite(userId, siteId);
  if (!availableEngines().length) return null;
  const pending = await one<{ id: string }>("select id from prompt_runs where site_id = $1 and status = 'running'", [site.id]);
  if (pending) return pending.id;
  const run = await one<{ id: string }>("insert into prompt_runs (site_id, engines) values ($1, $2) returning id", [site.id, availableEngines().map((e) => e.id)]);
  await enqueue("prompt_run", { siteId: site.id, promptRunId: run!.id });
  return run!.id;
}

/** Job handler: asks every configured engine every active prompt, stores answers and metrics, updates GEO tasks. */
export async function executePromptRun(
  siteId: string,
  promptRunId: string | undefined,
  onProgress?: (msg: string) => void,
  engines: Engine[] = availableEngines(),
): Promise<void> {
  const runId =
    promptRunId ?? (await one<{ id: string }>("insert into prompt_runs (site_id, engines) values ($1, $2) returning id", [siteId, engines.map((e) => e.id)]))!.id;
  await q("update sites set next_prompt_run_at = now() + make_interval(days => $2) where id = $1", [siteId, PROMPT_RUN_DAYS]);
  try {
    if (!engines.length) throw new Error("No AI engines are configured. Add an API key for at least one engine.");
    const profile = await brandProfile(siteId);
    const rows = await q<PromptRow>("select id, text, intent, location, active from prompts where site_id = $1 and active order by created_at limit $2", [siteId, MAX_PROMPTS_PER_RUN]);
    if (!rows.length) throw new Error("No active prompts to run.");
    const idByText = new Map(rows.map((r) => [r.text, r.id]));
    const prompts: TrackedPrompt[] = rows.map((r) => ({ text: r.text, intent: r.intent, location: r.location ?? undefined }));
    const run = await trackVisibility(profile, prompts, engines, {
      brandFacts: profile.facts,
      onAnswer: (d, t) => onProgress?.(`${d} of ${t} answers`),
    });
    await tx(async (c) => {
      for (const a of run.answers) {
        const rec = run.records.find((r) => r.prompt === a.prompt && r.engine === a.engine && r.runAt === a.runAt);
        const ai = await one<{ id: string }>(
          "insert into ai_runs (prompt_run_id, prompt_id, prompt_text, engine, model, run_at, answer_text, cited_urls, error) values ($1,$2,$3,$4,$5,$6,$7,$8,$9) returning id",
          [runId, idByText.get(a.prompt) ?? null, a.prompt, a.engine, a.model, a.runAt, a.text || null, a.citedUrls, a.error ?? null],
          c,
        );
        for (const m of rec?.mentions ?? []) {
          await q(
            "insert into ai_mentions (ai_run_id, entity, is_brand, mentioned, position, cited_urls, sentiment, fact_errors) values ($1,$2,$3,$4,$5,$6,$7,$8)",
            [ai!.id, m.entity, m.isBrand, m.mentioned, m.position, m.citedUrls, m.sentiment, m.factErrors],
            c,
          );
        }
      }
      const failed = run.answers.filter((a) => a.error).length;
      await q("update prompt_runs set status = 'done', finished_at = now(), metrics = $2, error = $3 where id = $1", [
        runId,
        JSON.stringify({ overall: run.overall, byEngine: run.byEngine, topSources: run.topSources }),
        failed ? `${failed} of ${run.answers.length} engine calls failed` : null,
      ], c);
      await syncTasks(siteId, "geo", `https://${profile.domain}`, run.issues, c);
      await snapshotScores(siteId, c);
    });
  } catch (e) {
    await q("update prompt_runs set status = 'failed', finished_at = now(), error = $2 where id = $1", [runId, (e as Error).message]);
    throw e;
  }
}

export async function latestPromptRun(userId: string, siteId: string) {
  const site = await requireSite(userId, siteId);
  const run = await one<{ id: string; started_at: Date; finished_at: Date | null; status: string; engines: string[]; metrics: any; error: string | null }>(
    "select * from prompt_runs where site_id = $1 order by started_at desc limit 1",
    [site.id],
  );
  if (!run) return null;
  const answers = await q<{ id: string; prompt_text: string; engine: string; model: string; answer_text: string | null; cited_urls: string[]; error: string | null; brand_mentioned: boolean | null; brand_position: number | null; brand_sentiment: string | null; rivals: string[] | null }>(
    `select a.id, a.prompt_text, a.engine, a.model, a.answer_text, a.cited_urls, a.error,
            b.mentioned as brand_mentioned, b.position as brand_position, b.sentiment as brand_sentiment,
            (select array_agg(entity) from ai_mentions r where r.ai_run_id = a.id and not r.is_brand and r.mentioned) as rivals
       from ai_runs a left join ai_mentions b on b.ai_run_id = a.id and b.is_brand
      where a.prompt_run_id = $1 order by a.prompt_text, a.engine`,
    [run.id],
  );
  return { run, answers };
}
