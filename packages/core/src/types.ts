// Shared types. Field names follow the PRD's core data model (docs/PRD.md) so they map
// one-to-one onto the Supabase tables in supabase/migrations.

export type Module = "seo" | "geo" | "both";
export type Severity = "critical" | "warning" | "notice";

export interface LinkRef {
  href: string; // absolute URL
  text: string;
  internal: boolean;
}

export interface PageData {
  url: string;
  finalUrl: string;
  statusCode: number;
  redirectChain: string[];
  contentType: string;
  fetchError?: string;
  title?: string;
  metaDescription?: string;
  metaRobots?: string;
  canonical?: string;
  lang?: string;
  h1: string[];
  h2: string[];
  wordCount: number;
  /** Visible text, first ~600 chars — used by the citability checks. */
  leadText: string;
  /** Words of text present in the raw HTML vs number of <script> tags: used for the no-JS check. */
  scriptCount: number;
  imagesMissingAlt: string[];
  imageCount: number;
  links: LinkRef[];
  schemaTypes: string[];
  hasDateSignal: boolean;
  hasAuthorSignal: boolean;
  hasFaqMarkup: boolean;
  depth: number;
}

export interface RobotsInfo {
  url: string;
  found: boolean;
  statusCode?: number;
  sitemaps: string[];
  /** AI crawler user agent -> blocked from the site root. */
  aiBots: Record<string, boolean>;
  blocksEverything: boolean;
}

export interface SiteData {
  origin: string;
  startUrl: string;
  https: boolean;
  robots: RobotsInfo;
  sitemapUrls: string[];
  sitemapFound: boolean;
  llmsTxtFound: boolean;
  pages: PageData[];
  /** URLs linked from crawled pages that we checked but did not crawl (external or over budget). */
  checkedLinks: Record<string, number>;
  crawledAt: string;
  truncated: boolean;
}

export interface Issue {
  /** Stable rule id, e.g. "title-missing". */
  type: string;
  module: Module;
  severity: Severity;
  title: string;
  why: string;
  steps: string[];
  impact: number; // 1-5
  effort: number; // 1-5
  confidence: number; // 0-1
  /** Affected URLs (empty for site-level issues). */
  urls: string[];
  /** Optional AI-ready fix, e.g. a JSON-LD block or robots.txt snippet. */
  draftFix?: string;
}

export type TaskStatus = "todo" | "in_progress" | "done" | "ignored";

export interface Task extends Issue {
  id: string;
  priority: number;
  status: TaskStatus;
}

export interface Scores {
  technical: number;
  /** null until rank data (Search Console / rank tracker) is connected. */
  search: number | null;
  /** AI readiness from the on-site audit, blended with tracked AI visibility when available. */
  aiVisibility: number;
  aiReadiness: number;
}

export interface AuditResult {
  site: SiteData;
  issues: Issue[];
  tasks: Task[];
  scores: Scores;
}
