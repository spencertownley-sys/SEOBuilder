import type { PageData, SiteData } from "../types.js";
import { extractPage, extractSitemapUrls } from "./extract.js";
import { politeFetch, USER_AGENT, type FetchOptions } from "./fetcher.js";
import { aiBotAccess, isAllowed, parseRobots, type Robots } from "./robots.js";

export interface CrawlOptions {
  /** PRD: 500 pages on the base plan; the free audit uses fewer. */
  maxPages?: number;
  concurrency?: number;
  /** Delay between requests per worker, to protect small sites. */
  delayMs?: number;
  /** HEAD-check up to this many external links for breakage. */
  maxExternalChecks?: number;
  fetch?: FetchOptions;
  onProgress?: (crawled: number, queued: number) => void;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function normalize(url: string): string {
  const u = new URL(url);
  u.hash = "";
  if (u.pathname !== "/" && u.pathname.endsWith("/index.html")) u.pathname = u.pathname.slice(0, -"index.html".length);
  return u.toString();
}

async function loadSitemaps(urls: string[], fetchOpts: FetchOptions, limit: number): Promise<{ found: boolean; pages: string[] }> {
  const pages: string[] = [];
  const seen = new Set<string>();
  const queue = [...urls];
  let found = false;
  while (queue.length && seen.size < 10 && pages.length < limit) {
    const sm = queue.shift()!;
    if (seen.has(sm)) continue;
    seen.add(sm);
    const res = await politeFetch(sm, fetchOpts);
    if (res.status !== 200 || !/<(urlset|sitemapindex)/.test(res.body)) continue;
    found = true;
    const { urls: locs, childSitemaps } = extractSitemapUrls(res.body);
    pages.push(...locs);
    queue.push(...childSitemaps);
  }
  return { found, pages: pages.slice(0, limit) };
}

export async function crawlSite(startUrl: string, opts: CrawlOptions = {}): Promise<SiteData> {
  const { maxPages = 500, concurrency = 4, delayMs = 250, maxExternalChecks = 50, fetch: fetchOpts = {}, onProgress } = opts;
  const start = new URL(/^https?:\/\//i.test(startUrl) ? startUrl : `https://${startUrl}`);
  const origin = start.origin;

  // robots.txt
  const robotsUrl = `${origin}/robots.txt`;
  const robotsRes = await politeFetch(robotsUrl, fetchOpts);
  const robotsFound = robotsRes.status === 200 && !/<html/i.test(robotsRes.body.slice(0, 500));
  const robots: Robots = robotsFound ? parseRobots(robotsRes.body) : { groups: [], sitemaps: [] };

  // Sitemaps: those declared in robots.txt, else the conventional location.
  // Sites hosted under a path (e.g. GitHub Pages project sites) keep their sitemap there.
  const basePath = start.pathname.replace(/[^/]*$/, "");
  const sitemapCandidates = robots.sitemaps.length
    ? robots.sitemaps
    : [...new Set([`${origin}${basePath}sitemap.xml`, `${origin}/sitemap.xml`])];
  const sitemap = await loadSitemaps(sitemapCandidates, fetchOpts, maxPages * 2);

  const llms = await politeFetch(`${origin}/llms.txt`, fetchOpts);
  const llmsTxtFound = llms.status === 200 && !/<html/i.test(llms.body.slice(0, 500));

  // BFS from the start URL, seeded with sitemap URLs on the same host.
  const queue: { url: string; depth: number }[] = [{ url: normalize(start.toString()), depth: 0 }];
  const seen = new Set(queue.map((q) => q.url));
  for (const u of sitemap.pages) {
    try {
      const n = normalize(u);
      if (new URL(n).host === start.host && !seen.has(n)) {
        seen.add(n);
        queue.push({ url: n, depth: 1 });
      }
    } catch {
      /* bad loc */
    }
  }

  const pages: PageData[] = [];
  const checkedLinks: Record<string, number> = {};
  let truncated = false;

  let inflight = 0;

  async function worker() {
    for (;;) {
      if (pages.length + inflight >= maxPages) break;
      const item = queue.shift();
      if (!item) {
        // Another worker may still be discovering links.
        if (inflight === 0) break;
        await sleep(25);
        continue;
      }
      const path = new URL(item.url).pathname + new URL(item.url).search;
      if (robotsFound && !isAllowed(robots, USER_AGENT, path)) continue;
      inflight++;
      try {
        await crawlOne(item);
      } finally {
        inflight--;
      }
    }
  }

  async function crawlOne(item: { url: string; depth: number }) {
    {
      const res = await politeFetch(item.url, fetchOpts);
      const base = {
        url: item.url,
        finalUrl: res.finalUrl,
        statusCode: res.status,
        redirectChain: res.redirectChain,
        contentType: res.contentType,
        depth: item.depth,
      };
      checkedLinks[item.url] = res.status;
      let page: PageData;
      if (res.status >= 200 && res.status < 300 && /html/i.test(res.contentType)) {
        page = extractPage(res.body, base);
      } else {
        page = {
          ...base,
          fetchError: res.error,
          h1: [],
          h2: [],
          wordCount: 0,
          leadText: "",
          scriptCount: 0,
          imagesMissingAlt: [],
          imageCount: 0,
          links: [],
          schemaTypes: [],
          hasDateSignal: false,
          hasAuthorSignal: false,
          hasFaqMarkup: false,
        };
      }
      pages.push(page);
      // Redirects to another host are recorded but not followed into.
      if (new URL(res.finalUrl).host === start.host) {
        for (const link of page.links) {
          if (!link.internal) continue;
          const n = normalize(link.href);
          if (!seen.has(n)) {
            seen.add(n);
            queue.push({ url: n, depth: item.depth + 1 });
          }
        }
      }
      onProgress?.(pages.length, queue.length);
      if (delayMs) await sleep(delayMs);
    }
  }

  await Promise.all(Array.from({ length: concurrency }, worker));
  if (queue.length) truncated = true;

  // Status-check links we didn't crawl (external, or internal past the page budget).
  const unchecked = new Set<string>();
  for (const p of pages) for (const l of p.links) {
    const n = normalize(l.href);
    if (!(n in checkedLinks)) unchecked.add(n);
  }
  const toCheck = [...unchecked].slice(0, maxExternalChecks);
  for (let i = 0; i < toCheck.length; i += concurrency) {
    await Promise.all(
      toCheck.slice(i, i + concurrency).map(async (u) => {
        let r = await politeFetch(u, { ...fetchOpts, method: "HEAD", timeoutMs: 8000 });
        // Plenty of servers reject HEAD; confirm with GET before calling a link broken.
        if (r.status === 405 || r.status === 403 || r.status === 0) r = await politeFetch(u, { ...fetchOpts, timeoutMs: 8000, maxBytes: 50_000 });
        checkedLinks[u] = r.status;
      }),
    );
  }

  return {
    origin,
    startUrl: start.toString(),
    https: start.protocol === "https:",
    robots: {
      url: robotsUrl,
      found: robotsFound,
      statusCode: robotsRes.status,
      sitemaps: robots.sitemaps,
      aiBots: aiBotAccess(robots),
      blocksEverything: robotsFound && !isAllowed(robots, "*", "/"),
    },
    sitemapUrls: sitemapCandidates,
    sitemapFound: sitemap.found,
    llmsTxtFound,
    pages,
    checkedLinks,
    crawledAt: new Date().toISOString(),
    truncated,
  };
}
