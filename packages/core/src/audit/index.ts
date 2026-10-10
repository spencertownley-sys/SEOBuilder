import { crawlSite, type CrawlOptions } from "../crawl/crawler.js";
import type { AuditResult, Issue } from "../types.js";
import { runChecks } from "./checks.js";
import { pageSpeedIssues, runPageSpeed } from "./pagespeed.js";
import { buildActionPlan } from "./plan.js";
import { computeScores } from "./scoring.js";

export interface AuditOptions extends CrawlOptions {
  /** Call the PageSpeed Insights API for the start URL. Default true. */
  pageSpeed?: boolean;
}

export async function runAudit(url: string, opts: AuditOptions = {}): Promise<AuditResult> {
  const { pageSpeed = true, ...crawlOpts } = opts;
  const [site, psi] = await Promise.all([
    crawlSite(url, crawlOpts),
    pageSpeed ? runPageSpeed(/^https?:\/\//i.test(url) ? url : `https://${url}`) : Promise.resolve(null),
  ]);
  const issues: Issue[] = [...runChecks(site), ...(psi ? pageSpeedIssues(psi) : [])];
  const tasks = buildActionPlan(site.origin, issues);
  return { site, issues, tasks, scores: computeScores(issues) };
}
