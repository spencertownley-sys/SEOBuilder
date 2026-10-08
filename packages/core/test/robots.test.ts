import { describe, expect, it } from "vitest";
import { aiBotAccess, isAllowed, parseRobots } from "../src/crawl/robots.js";

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
});
