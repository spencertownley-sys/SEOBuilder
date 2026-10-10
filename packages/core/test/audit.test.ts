import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Server } from "node:http";
import { runAudit } from "../src/audit/index.js";
import { reconcilePlan } from "../src/audit/plan.js";
import type { AuditResult } from "../src/types.js";
import { startSite } from "./site.fixture.js";

let server: Server;
let origin: string;
let result: AuditResult;

beforeAll(async () => {
  ({ server, origin } = await startSite());
  result = await runAudit(origin, { pageSpeed: false, delayMs: 0, fetch: { blockPrivateNetworks: false } });
});
afterAll(() => server.close());

const types = () => result.issues.map((i) => i.type);
const issue = (t: string) => result.issues.find((i) => i.type === t)!;

describe("crawl", () => {
  it("finds pages by links and sitemap, follows redirects, reads robots", () => {
    const urls = result.site.pages.map((p) => new URL(p.url).pathname).sort();
    expect(urls).toEqual(["/", "/app", "/missing", "/old", "/orphan", "/pricing"]);
    expect(result.site.sitemapFound).toBe(true);
    expect(result.site.robots.aiBots["OAI-SearchBot"]).toBe(true);
    expect(result.site.robots.aiBots.ClaudeBot).toBe(false);
    const old = result.site.pages.find((p) => p.url.endsWith("/old"))!;
    expect(old.redirectChain).toHaveLength(2);
    expect(old.finalUrl).toBe(`${origin}/pricing`);
  });
});

describe("checks", () => {
  it("flags the planted problems", () => {
    expect(types()).toEqual(
      expect.arrayContaining([
        "no-https",
        "ai-bots-blocked",
        "broken-links",
        "redirect-chains",
        "title-duplicate",
        "meta-description-missing",
        "h1",
        "image-alt-missing",
        "js-only-content",
        "orphan-pages",
        "faq-missing",
        "llms-txt-missing",
      ]),
    );
    expect(issue("ai-bots-blocked").severity).toBe("critical"); // OAI-SearchBot powers ChatGPT search
    // External 404 counts; an external 403 (bot protection) does not.
    expect(issue("broken-links").urls.sort()).toEqual([`${origin}/missing`, `${origin.replace("127.0.0.1", "localhost")}/gone`]);
    expect(issue("js-only-content").urls).toEqual([`${origin}/app`]);
    expect(issue("orphan-pages").urls).toEqual([`${origin}/orphan`]);
    expect(issue("image-alt-missing").title).toContain("1 image");
  });

  it("does not flag what the site does right", () => {
    expect(types()).not.toContain("entity-schema-missing");
    expect(types()).not.toContain("sitemap-missing");
    expect(types()).not.toContain("robots-missing");
    expect(types()).not.toContain("citability-direct-answer"); // homepage leads with concrete facts
  });
});

describe("action plan and scores", () => {
  it("sorts tasks by priority and scores within range", () => {
    const ps = result.tasks.map((t) => t.priority);
    expect([...ps].sort((a, b) => b - a)).toEqual(ps);
    expect(result.tasks[0]!.type).toBe("ai-bots-blocked");
    for (const s of [result.scores.technical, result.scores.aiVisibility]) {
      expect(s).toBeGreaterThan(0);
      expect(s).toBeLessThan(100);
    }
    expect(result.scores.search).toBeNull();
  });

  it("reconciles a re-check: fixed tasks close, regressions reopen", () => {
    const prev = result.tasks.map((t) => (t.type === "broken-links" || t.type === "h1" ? { ...t, status: "done" as const } : t));
    const next = result.tasks.filter((t) => t.type !== "broken-links");
    const { fixed, reopened, tasks } = reconcilePlan(prev, next);
    expect(fixed.map((t) => t.type)).toEqual(["broken-links"]);
    expect(reopened.map((t) => t.type)).toEqual(["h1"]);
    expect(tasks.find((t) => t.type === "h1")!.status).toBe("todo");
  });
});
