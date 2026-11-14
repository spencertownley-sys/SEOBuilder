import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { crawlSite } from "../src/crawl/crawler.js";
import { crawlDelayFor, parseRobots } from "../src/crawl/robots.js";

let server: Server | undefined;
afterEach(() => server?.close());

/** A tiny site: robots.txt answers as given, and / links to /a and /b. Records each request. */
async function site(robots: { status: number; body?: string }) {
  const hits: { path: string; at: number }[] = [];
  server = createServer((req, res) => {
    const path = req.url ?? "/";
    hits.push({ path, at: Date.now() });
    if (path === "/robots.txt") {
      res.writeHead(robots.status, { "content-type": "text/plain" });
      return res.end(robots.body ?? "");
    }
    if (path === "/" || path === "/a" || path === "/b") {
      res.writeHead(200, { "content-type": "text/html" });
      return res.end(`<html><head><title>${path}</title></head><body><a href="/a">a</a> <a href="/b">b</a></body></html>`);
    }
    res.writeHead(404, { "content-type": "text/plain" });
    res.end("not found");
  });
  await new Promise<void>((r) => server!.listen(0, "127.0.0.1", r));
  return { origin: `http://127.0.0.1:${(server!.address() as AddressInfo).port}`, hits };
}

const opts = { delayMs: 0, maxExternalChecks: 0, fetch: { blockPrivateNetworks: false } };

describe("robots.txt availability (RFC 9309)", () => {
  it("crawls zero pages when robots.txt answers 5xx", async () => {
    const { origin, hits } = await site({ status: 503 });
    await expect(crawlSite(origin, opts)).rejects.toThrow(/robots\.txt unavailable \(HTTP 503\)/);
    expect(hits.map((h) => h.path)).toEqual(["/robots.txt"]);
  });

  it("crawls zero pages when robots.txt can't be fetched at all", async () => {
    await expect(crawlSite("http://127.0.0.1:1/", opts)).rejects.toThrow(/robots\.txt unavailable/);
  });

  it("treats a missing robots.txt (404) as allow-all", async () => {
    const { origin } = await site({ status: 404 });
    const result = await crawlSite(origin, opts);
    expect(result.pages.map((p) => new URL(p.url).pathname).sort()).toEqual(["/", "/a", "/b"]);
  });
});

describe("Crawl-delay", () => {
  it("is read per group and capped at 10 seconds", () => {
    const r = parseRobots("User-agent: *\nCrawl-delay: 30\n\nUser-agent: MentionfulBot\nCrawl-delay: 2\n");
    expect(crawlDelayFor(r, "MentionfulBot/0.1")).toBe(2);
    expect(crawlDelayFor(r, "OtherBot")).toBe(10);
    expect(crawlDelayFor(parseRobots("User-agent: *\nDisallow: /x"), "OtherBot")).toBe(0);
  });

  it("spaces page requests to the host by the delay", async () => {
    const { origin, hits } = await site({ status: 200, body: "User-agent: *\nCrawl-delay: 0.3\n" });
    const result = await crawlSite(origin, opts);
    expect(result.pages).toHaveLength(3);
    const pageHits = hits.filter((h) => ["/", "/a", "/b"].includes(h.path));
    for (let i = 1; i < pageHits.length; i++) expect(pageHits[i]!.at - pageHits[i - 1]!.at).toBeGreaterThanOrEqual(280);
  });
});
