import { describe, expect, it } from "vitest";
import { crawlerAllowed } from "../src/crawl/crawler.js";
import { USER_AGENT } from "../src/crawl/fetcher.js";
import { aiBotAccess, isAllowed, matchRule, MAX_RULES_PER_GROUP, parseRobots } from "../src/crawl/robots.js";

describe("robots", () => {
  const r = parseRobots(`
User-agent: *
Disallow: /private/
Allow: /private/ok$

User-agent: GPTBot
User-agent: CCBot
Disallow: /

Sitemap: https://example.com/sitemap.xml
`);

  it("applies longest match and allow-on-tie", () => {
    expect(isAllowed(r, "Mozilla", "/")).toBe(true);
    expect(isAllowed(r, "Mozilla", "/private/x")).toBe(false);
    expect(isAllowed(r, "Mozilla", "/private/ok")).toBe(true);
    expect(isAllowed(r, "Mozilla", "/private/ok/more")).toBe(false);
  });

  it("groups consecutive user-agent lines and matches product tokens", () => {
    expect(isAllowed(r, "Mozilla/5.0 (compatible; GPTBot/1.2)", "/")).toBe(false);
    expect(isAllowed(r, "CCBot/2.0", "/anything")).toBe(false);
  });

  it("reports AI bot access and sitemaps", () => {
    const access = aiBotAccess(r);
    expect(access.GPTBot).toBe(true);
    expect(access.ClaudeBot).toBe(false);
    expect(r.sitemaps).toEqual(["https://example.com/sitemap.xml"]);
  });

  it("treats empty Disallow as allow-all", () => {
    expect(isAllowed(parseRobots("User-agent: *\nDisallow:"), "x", "/a")).toBe(true);
  });

  it("matches wildcards and end anchors like RFC 9309", () => {
    expect(matchRule("/", "/anything")).toBe(true);
    expect(matchRule("/fish", "/fish.html")).toBe(true);
    expect(matchRule("/fish", "/Fish")).toBe(false);
    expect(matchRule("/*.php", "/index.php")).toBe(true);
    expect(matchRule("/*.php", "/folder/x.php?q=1")).toBe(true);
    expect(matchRule("/*.php$", "/x.php")).toBe(true);
    expect(matchRule("/*.php$", "/x.php?q=1")).toBe(false);
    expect(matchRule("/fish*.php", "/fishheads/catfish.php")).toBe(true);
    expect(matchRule("/fish*.php", "/fish.ph")).toBe(false);
    expect(matchRule("/a*b*c", "/aXbYc/more")).toBe(true);
    expect(matchRule("/a*b*c$", "/aXbYcZ")).toBe(false);
    expect(matchRule("*", "/")).toBe(true);
    expect(matchRule("/$", "/")).toBe(true);
    expect(matchRule("/$", "/x")).toBe(false);
    expect(matchRule("/a.b+c(", "/a.b+c(d")).toBe(true); // regex characters are literal
  });

  it("stays fast on a hostile wildcard rule", () => {
    const hostile = parseRobots("User-agent: *\nDisallow: /*a*a*a*a*a*a*a*a*b");
    const t0 = performance.now();
    expect(isAllowed(hostile, "MentionfulBot", "/" + "a".repeat(5000))).toBe(true);
    expect(performance.now() - t0).toBeLessThan(50);
  });

  it("ignores oversized rules and caps rules per group", () => {
    const long = parseRobots(`User-agent: *\nDisallow: /${"x".repeat(600)}\nDisallow: /short`);
    expect(long.groups[0]!.rules.map((x) => x.pattern)).toEqual(["/short"]);
    const many = parseRobots("User-agent: *\n" + Array.from({ length: 800 }, (_, i) => `Disallow: /p${i}`).join("\n"));
    expect(many.groups[0]!.rules).toHaveLength(MAX_RULES_PER_GROUP);
  });

  it("identifies as MentionfulBot and still obeys rules written for SEOBuilderBot", () => {
    expect(USER_AGENT).toMatch(/^MentionfulBot\/[\d.]+ \(\+https:\/\/mentionful\.com\/bot\)$/);
    expect(crawlerAllowed(parseRobots("User-agent: MentionfulBot\nDisallow: /"), "/x")).toBe(false);
    expect(crawlerAllowed(parseRobots("User-agent: SEOBuilderBot\nDisallow: /"), "/x")).toBe(false);
    expect(crawlerAllowed(parseRobots("User-agent: GPTBot\nDisallow: /"), "/x")).toBe(true);
  });
});
