// Integration tests against a real Postgres (TEST_DATABASE_URL) and the core fixture site.
import type { Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Engine } from "@seobuilder/core";
import { FILES, startSite } from "../../core/test/site.fixture.js";

const DB = process.env.TEST_DATABASE_URL ?? "postgres://postgres@127.0.0.1:54329/seobuilder_test";
process.env.DATABASE_URL = DB;
process.env.ALLOW_PRIVATE_NETWORKS = "1";
process.env.PAGESPEED_DISABLED = "1";

const P = await import("../src/index.js");

let server: Server;
let origin: string;
let alice: { id: string; email: string };
let bob: { id: string; email: string };
let siteId: string;

beforeAll(async () => {
  await P.q("drop schema public cascade");
  await P.q("create schema public");
  await P.migrate();
  ({ server, origin } = await startSite());
  alice = await P.signUp("Alice@Example.com", "correct horse battery");
  bob = await P.signUp("bob@example.com", "another long password");
});
afterAll(async () => {
  P.startBackgroundWorker().stop();
  server.close();
  await P.closePool();
});

describe("auth", () => {
  it("logs in with the right password only, case-insensitively by email", async () => {
    expect((await P.logIn("alice@example.com", "correct horse battery")).id).toBe(alice.id);
    await expect(P.logIn("alice@example.com", "wrong password")).rejects.toThrow(/don't match/);
    await expect(P.logIn("nobody@example.com", "whatever123")).rejects.toThrow(/don't match/);
  });

  it("rejects duplicates and weak passwords", async () => {
    await expect(P.signUp("alice@example.com", "something long")).rejects.toThrow(/already exists/);
    await expect(P.signUp("c@example.com", "short")).rejects.toThrow(/at least 8/);
  });

  it("issues sessions that resolve to the user and can be revoked", async () => {
    const token = await P.createSession(alice.id);
    expect((await P.userFromSession(token))?.email).toBe("alice@example.com");
    expect(await P.userFromSession(token + "x")).toBeNull();
    await P.destroySession(token);
    expect(await P.userFromSession(token)).toBeNull();
  });

  it("never stores raw passwords or tokens", async () => {
    const [u] = await P.q<{ password_hash: string }>("select password_hash from users where id = $1", [alice.id]);
    expect(u!.password_hash).toMatch(/^scrypt\$/);
  });
});

describe("sites", () => {
  it("creates a site with seeded prompts and a queued crawl", async () => {
    siteId = await P.createSite(alice.id, {
      url: origin,
      name: "Example Studio",
      businessType: "wedding photographer",
      services: "elopement photography, engagement photos",
      locations: "Tacoma",
      competitors: "Rival Photo",
    });
    const prompts = await P.listPrompts(alice.id, siteId);
    expect(prompts.length).toBeGreaterThanOrEqual(10);
    const jobs = await P.q<{ kind: string }>("select kind from jobs where payload->>'siteId' = $1", [siteId]);
    expect(jobs.map((j) => j.kind)).toContain("site_crawl");
    await expect(P.createSite(alice.id, { url: origin })).rejects.toThrow(/already added/);
  });

  it("keeps other users out", async () => {
    await expect(P.requireSite(bob.id, siteId)).rejects.toThrow(/not found/i);
    await expect(P.listTasks(bob.id, siteId)).rejects.toThrow(/not found/i);
    expect(await P.listSites(bob.id)).toHaveLength(0);
    expect(await P.listSites(alice.id)).toHaveLength(1);
  });

  it("parses competitor lines", () => {
    expect(P.parseCompetitor("Rival | rival.com")).toEqual({ name: "Rival", domain: "rival.com" });
    expect(P.parseCompetitor("https://www.rival.com/x")).toEqual({ name: "rival.com", domain: "rival.com" });
    expect(P.parseCompetitor("Rival Photo")).toEqual({ name: "Rival Photo", domain: null });
  });
});

describe("crawl persistence and the re-check loop", () => {
  it("stores pages, issues, tasks and a score snapshot", async () => {
    const r = await P.crawlSavedSite(siteId);
    expect(r.added).toContain("broken-links");
    const tasks = await P.listTasks(alice.id, siteId);
    expect(tasks.map((t) => t.type)).toEqual(expect.arrayContaining(["broken-links", "ai-bots-blocked", "js-only-content"]));
    const [pages] = await P.q<{ n: number }>("select count(*)::int as n from pages p join crawls c on c.id = p.crawl_id where c.site_id = $1", [siteId]);
    expect(pages!.n).toBeGreaterThan(3);
    const ov = await P.siteOverview(alice.id, siteId);
    expect(ov.scores).toHaveLength(1);
    expect(ov.lastCrawl?.status).toBe("done");
  });

  it("marking Done queues a re-check; fixed issues resolve, unfixed ones reopen", async () => {
    const tasks = await P.listTasks(alice.id, siteId);
    const broken = tasks.find((t) => t.type === "broken-links")!;
    const h1 = tasks.find((t) => t.type === "h1")!;
    const ignored = tasks.find((t) => t.type === "faq-missing")!;
    expect((await P.setTaskStatus(alice.id, siteId, broken.id, "done")).recheckQueued).toBe(true);
    await P.setTaskStatus(alice.id, siteId, h1.id, "done");
    await P.setTaskStatus(alice.id, siteId, ignored.id, "ignored");
    const queued = await P.q("select 1 from jobs where kind = 'site_crawl' and status = 'queued' and payload->>'siteId' = $1", [siteId]);
    expect(queued).toHaveLength(1); // Done clicks share one pending crawl rather than queueing one each

    // The owner fixes the broken links.
    const home = FILES["/"]!;
    const before = home.body;
    home.body = before.replace('<a href="/missing">Missing</a>', "").replace(/<a href="\{alt\}\/gone">Dead external<\/a>/, "");
    try {
      const r = await P.crawlSavedSite(siteId);
      expect(r.fixed).toContain("broken-links");
    } finally {
      home.body = before;
    }
    const after = await P.listTasks(alice.id, siteId);
    expect(after.find((t) => t.id === broken.id)).toMatchObject({ resolved: true, status: "done" });
    expect(after.find((t) => t.id === h1.id)).toMatchObject({ resolved: false, status: "todo" }); // still broken: reopened
    expect(after.find((t) => t.id === ignored.id)!.status).toBe("ignored");
    const [crawl] = await P.q<{ fixed_issues: string[] }>("select fixed_issues from crawls where site_id = $1 order by started_at desc limit 1", [siteId]);
    expect(crawl!.fixed_issues).toEqual(["broken-links"]);
  });
});

describe("AI visibility runs", () => {
  it("stores answers and mentions, creates GEO tasks and blends tracking into the score", async () => {
    const fake: Engine = {
      id: "perplexity",
      model: "fake-1",
      available: () => true,
      ask: async (prompt) => ({
        engine: "perplexity",
        model: "fake-1",
        text: prompt.includes("vs") ? "Example Studio and Rival Photo are both good." : "Rival Photo is the top pick.",
        citedUrls: ["https://www.theknot.com/x"],
        runAt: new Date().toISOString(),
      }),
    };
    const run = await P.one<{ id: string }>("insert into prompt_runs (site_id, engines) values ($1, '{perplexity}') returning id", [siteId]);
    await P.executePromptRun(siteId, run!.id, undefined, [fake]);
    const latest = await P.latestPromptRun(alice.id, siteId);
    expect(latest!.run.status).toBe("done");
    expect(latest!.answers.length).toBeGreaterThan(5);
    expect(latest!.answers.some((a) => a.brand_mentioned)).toBe(true);
    expect(latest!.answers.some((a) => a.rivals?.includes("Rival Photo"))).toBe(true);
    const geo = (await P.listTasks(alice.id, siteId)).filter((t) => t.source === "geo").map((t) => t.type);
    expect(geo).toEqual(expect.arrayContaining(["ai-competitor-gap", "ai-source-opportunities"]));
    const ov = await P.siteOverview(alice.id, siteId);
    const last = ov.scores.at(-1)!;
    expect(last.ai_visibility).not.toBe(last.ai_readiness);
  });

  it("a later audit leaves GEO tasks alone", async () => {
    await P.crawlSavedSite(siteId);
    const geo = (await P.listTasks(alice.id, siteId)).filter((t) => t.source === "geo" && !t.resolved);
    expect(geo.length).toBeGreaterThan(0);
  });
});

/** Runs fn with some environment variables set, then restores them. */
async function withEnv<T>(vars: Record<string, string>, fn: () => Promise<T>): Promise<T> {
  const before = Object.fromEntries(Object.keys(vars).map((k) => [k, process.env[k]]));
  Object.assign(process.env, vars);
  try {
    return await fn();
  } finally {
    for (const [k, v] of Object.entries(before)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}

describe("fair-use limits (SB-02)", () => {
  let carol: { id: string; email: string };
  const carolSites: string[] = [];

  beforeAll(async () => {
    carol = await P.signUp("carol@example.com", "carol's long password");
  });
  afterAll(async () => {
    await P.q("delete from jobs where payload->>'siteId' = any($1)", [carolSites]);
    await P.q("delete from sites where id = any($1)", [carolSites]);
  });

  it("refuses a 4th site in one workspace", async () => {
    for (const d of ["one.example", "two.example", "three.example"]) carolSites.push(await P.createSite(carol.id, { url: d }));
    await expect(P.createSite(carol.id, { url: "four.example" })).rejects.toThrow(/up to 3 sites/);
    expect(await P.listSites(carol.id)).toHaveLength(3);
  });

  it("returns the existing run inside the cooldown instead of queueing another", async () => {
    await withEnv({ PERPLEXITY_API_KEY: "test-key" }, async () => {
      const first = await P.requestPromptRun(carol.id, carolSites[0]!);
      expect(first).toBeTruthy();
      expect(await P.requestPromptRun(carol.id, carolSites[0]!)).toBe(first); // still running
      await P.q("update prompt_runs set status = 'done', finished_at = now() where id = $1", [first]);
      expect(await P.requestPromptRun(carol.id, carolSites[0]!)).toBe(first); // done, but within 24 hours
      const runs = await P.q("select 1 from prompt_runs where site_id = $1", [carolSites[0]]);
      expect(runs).toHaveLength(1);
    });
  });

  it("caps prompt runs per workspace and across the service", async () => {
    await withEnv({ PERPLEXITY_API_KEY: "test-key", PROMPT_RUN_COOLDOWN_HOURS: "0", MAX_PROMPT_RUNS_PER_WORKSPACE_PER_DAY: "1" }, async () => {
      await expect(P.requestPromptRun(carol.id, carolSites[1]!)).rejects.toThrow(/AI tracking runs for today/);
    });
    await withEnv({ PERPLEXITY_API_KEY: "test-key", PROMPT_RUN_COOLDOWN_HOURS: "0", MAX_PROMPT_RUNS_PER_DAY: "1" }, async () => {
      await expect(P.requestPromptRun(carol.id, carolSites[1]!)).rejects.toThrow(/daily limit/);
    });
    const runs = await P.q("select 1 from prompt_runs where site_id = $1", [carolSites[1]]);
    expect(runs).toHaveLength(0);
  });

  it("schedules weekly AI runs only for verified sites", async () => {
    const queuedRuns = async (id: string) => (await P.q("select 1 from jobs where kind = 'prompt_run' and status = 'queued' and payload->>'siteId' = $1 and payload->>'promptRunId' is null", [id])).length;
    await withEnv({ PERPLEXITY_API_KEY: "test-key" }, async () => {
      await P.scheduleDue();
      expect(await queuedRuns(carolSites[2]!)).toBe(0);
      await P.q("update sites set verified_at = now() where id = $1", [carolSites[2]]);
      await P.scheduleDue();
      expect(await queuedRuns(carolSites[2]!)).toBe(1);
      await P.scheduleDue();
      expect(await queuedRuns(carolSites[2]!)).toBe(1); // next_prompt_run_at moved a week out
    });
  });
});

describe("public audits", () => {
  it("rate-limits per requester and reuses fresh reports", async () => {
    const ids = new Set<string>();
    for (let i = 0; i < P.PUBLIC_AUDITS_PER_HOUR; i++) ids.add(await P.requestPublicAudit(`${origin}/?v=${i}`, "203.0.113.9"));
    expect(ids.size).toBe(P.PUBLIC_AUDITS_PER_HOUR);
    await expect(P.requestPublicAudit(`${origin}/?v=99`, "203.0.113.9")).rejects.toThrow(/last hour/);
    const again = await P.requestPublicAudit(`${origin}/?v=0`, "198.51.100.1");
    expect(ids.has(again)).toBe(true);
    await expect(P.requestPublicAudit("not a url", "198.51.100.1")).rejects.toThrow(/website address/);
  });

  it("runs end to end through the background worker", async () => {
    await P.q("delete from jobs where kind = 'public_audit'");
    const id = await P.requestPublicAudit(origin, "192.0.2.50");
    P.startBackgroundWorker(2);
    let report = await P.getPublicReport(id);
    for (let i = 0; i < 100 && report && report.state !== "done" && report.state !== "failed"; i++) {
      await new Promise((r) => setTimeout(r, 200));
      report = await P.getPublicReport(id);
    }
    expect(report?.state).toBe("done");
    if (report?.state === "done") {
      expect(report.result.tasks.length).toBeGreaterThan(5);
      expect(report.result.scores.technical).toBeLessThan(100);
    }
    expect(await P.getPublicReport("00000000-0000-0000-0000-000000000000")).toBeNull();
    expect(await P.getPublicReport("../etc/passwd")).toBeNull();
  });
});
