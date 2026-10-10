import { runAudit, type AuditResult, type Task } from "@seobuilder/core";
import { one, q, tx } from "./db.js";
import { requireSite, type CompetitorRow, type SiteRow } from "./sites.js";
import { snapshotScores, syncTasks } from "./tasks.js";

export const SITE_PAGE_LIMIT = Number(process.env.SITE_PAGE_LIMIT ?? 200);
export const PUBLIC_PAGE_LIMIT = Number(process.env.PUBLIC_PAGE_LIMIT ?? 50);
export const RECRAWL_DAYS = 7;

// Test-only switches: the integration tests crawl a fixture site on localhost and skip PageSpeed.
// Never set ALLOW_PRIVATE_NETWORKS in production; it disables the SSRF guard.
function auditOptions() {
  return {
    pageSpeed: process.env.PAGESPEED_DISABLED !== "1",
    fetch: { blockPrivateNetworks: process.env.ALLOW_PRIVATE_NETWORKS !== "1" },
    delayMs: process.env.ALLOW_PRIVATE_NETWORKS === "1" ? 0 : 250,
  };
}

/** Crawls a saved site, stores pages/issues/tasks and a score snapshot. */
export async function crawlSavedSite(siteId: string, onProgress?: (msg: string) => void): Promise<{ crawlId: string; added: string[]; fixed: string[] }> {
  const site = await one<SiteRow>("select * from sites where id = $1", [siteId]);
  if (!site) throw new Error("Site was deleted");
  const crawl = await one<{ id: string }>("insert into crawls (site_id) values ($1) returning id", [siteId]);
  await q("update sites set next_crawl_at = now() + make_interval(days => $2) where id = $1", [siteId, RECRAWL_DAYS]);
  let result: AuditResult;
  try {
    result = await runAudit(site.url, {
      ...auditOptions(),
      maxPages: SITE_PAGE_LIMIT,
      onProgress: (n, queued) => onProgress?.(`Crawled ${n} pages, ${queued} queued`),
    });
  } catch (e) {
    await q("update crawls set status = 'failed', finished_at = now(), error = $2 where id = $1", [crawl!.id, (e as Error).message]);
    throw e;
  }
  const reachable = result.site.pages.some((p) => p.statusCode >= 200 && p.statusCode < 300);
  if (!reachable) {
    const err = result.site.pages[0]?.fetchError ?? `HTTP ${result.site.pages[0]?.statusCode ?? 0}`;
    await q("update crawls set status = 'failed', finished_at = now(), pages_crawled = $2, error = $3 where id = $1", [crawl!.id, result.site.pages.length, err]);
    throw new Error(`Couldn't load ${site.url}: ${err}`);
  }

  return tx(async (c) => {
    const pages = result.site.pages;
    await q(
      `insert into pages (crawl_id, url, final_url, status_code, title, meta_description, canonical, h1, schema_types, word_count)
       select $1, x.url, x.final_url, x.status_code, x.title, x.meta, x.canonical,
              coalesce((select array_agg(v) from jsonb_array_elements_text(x.h1) v), '{}'),
              coalesce((select array_agg(v) from jsonb_array_elements_text(x.schema_types) v), '{}'),
              x.word_count
         from jsonb_to_recordset($2::jsonb) as x(url text, final_url text, status_code int, title text, meta text, canonical text, h1 jsonb, schema_types jsonb, word_count int)`,
      [
        crawl!.id,
        JSON.stringify(
          pages.map((p) => ({
            url: p.url,
            final_url: p.finalUrl,
            status_code: p.statusCode,
            title: p.title ?? null,
            meta: p.metaDescription ?? null,
            canonical: p.canonical ?? null,
            h1: p.h1,
            schema_types: p.schemaTypes,
            word_count: p.wordCount,
          })),
        ),
      ],
      c,
    );

    // Issues table: open new ones, refresh existing ones, resolve the ones that went away.
    const types = result.issues.map((i) => i.type);
    await q("update issues set resolved_at = now() where site_id = $1 and resolved_at is null and not (type = any($2))", [siteId, types], c);
    for (const i of result.issues) {
      await q(
        `insert into issues (site_id, type, severity, module, urls) values ($1, $2, $3, $4, $5)
         on conflict (site_id, type) where resolved_at is null do update set severity = excluded.severity, module = excluded.module, urls = excluded.urls`,
        [siteId, i.type, i.severity, i.module, i.urls],
        c,
      );
    }

    const { added, fixed } = await syncTasks(siteId, "audit", result.site.origin, result.issues, c);
    await snapshotScores(siteId, c);
    await q(
      "update crawls set status = 'done', finished_at = now(), pages_crawled = $2, robots = $3, new_issues = $4, fixed_issues = $5 where id = $1",
      [crawl!.id, pages.length, JSON.stringify(result.site.robots), added, fixed],
      c,
    );
    return { crawlId: crawl!.id, added, fixed };
  });
}

/** Smaller crawl of a competitor's site for the side-by-side scores (PRD P0). */
export async function auditCompetitor(competitorId: string): Promise<void> {
  const comp = await one<CompetitorRow>("select * from competitors where id = $1", [competitorId]);
  if (!comp?.domain) return;
  const result = await runAudit(`https://${comp.domain}/`, { ...auditOptions(), maxPages: 30 });
  if (!result.site.pages.some((p) => p.statusCode >= 200 && p.statusCode < 300)) throw new Error(`Couldn't load ${comp.domain}`);
  await q("update competitors set scores = $2, audited_at = now() where id = $1", [competitorId, JSON.stringify(result.scores)]);
}

export interface PublicAuditResult {
  url: string;
  origin: string;
  host: string;
  pagesCrawled: number;
  truncated: boolean;
  crawledAt: string;
  robots: AuditResult["site"]["robots"];
  scores: AuditResult["scores"];
  tasks: Task[];
  error?: string;
}

/** The free audit, trimmed to what the report page shows. */
export async function runPublicAudit(url: string, onProgress?: (msg: string) => void): Promise<PublicAuditResult> {
  const result = await runAudit(url, {
    ...auditOptions(),
    maxPages: PUBLIC_PAGE_LIMIT,
    onProgress: (n, queued) => onProgress?.(`Crawled ${n} pages, ${queued} queued`),
  });
  const { site } = result;
  const reachable = site.pages.some((p) => p.statusCode >= 200 && p.statusCode < 300);
  const base = {
    url,
    origin: site.origin,
    host: new URL(site.startUrl).host,
    pagesCrawled: site.pages.length,
    truncated: site.truncated,
    crawledAt: site.crawledAt,
    robots: site.robots,
  };
  if (!reachable) {
    const err = site.pages[0]?.fetchError ?? `HTTP ${site.pages[0]?.statusCode ?? "error"}`;
    return { ...base, scores: result.scores, tasks: [], error: err };
  }
  return { ...base, scores: result.scores, tasks: result.tasks };
}

export async function siteOverview(userId: string, siteId: string) {
  const site = await requireSite(userId, siteId);
  const [scores, lastCrawl, competitors, crawlJob, promptRun] = await Promise.all([
    q<{ taken_at: Date; technical: number; search: number | null; ai_visibility: number; ai_readiness: number }>(
      "select * from (select * from score_snapshots where site_id = $1 order by taken_at desc limit 60) s order by taken_at",
      [site.id],
    ),
    one<{ id: string; status: string; finished_at: Date | null; started_at: Date; pages_crawled: number; new_issues: string[]; fixed_issues: string[]; error: string | null; robots: AuditResult["site"]["robots"] | null }>(
      "select * from crawls where site_id = $1 order by started_at desc limit 1",
      [site.id],
    ),
    q<CompetitorRow>("select * from competitors where site_id = $1 order by name", [site.id]),
    one<{ status: string; progress: string | null; run_after: Date }>(
      "select status, progress, run_after from jobs where kind = 'site_crawl' and status in ('queued','running') and payload->>'siteId' = $1 order by created_at limit 1",
      [site.id],
    ),
    one<{ started_at: Date; finished_at: Date | null; status: string; metrics: unknown }>(
      "select started_at, finished_at, status, metrics from prompt_runs where site_id = $1 order by started_at desc limit 1",
      [site.id],
    ),
  ]);
  return { site, scores, lastCrawl, competitors, crawlJob, promptRun };
}
