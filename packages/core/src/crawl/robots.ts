// Minimal robots.txt parser (RFC 9309 matching: longest match wins, Allow wins ties,
// `*` wildcards and `$` anchors supported).

export const AI_BOTS = [
  "GPTBot",
  "OAI-SearchBot",
  "ChatGPT-User",
  "ClaudeBot",
  "Claude-SearchBot",
  "Claude-User",
  "PerplexityBot",
  "Google-Extended",
  "Applebot-Extended",
  "Bingbot",
  "CCBot",
] as const;

/** Bots whose blocking removes a site from a major AI assistant's answers or citations. */
export const AI_ANSWER_BOTS = ["OAI-SearchBot", "ChatGPT-User", "Claude-SearchBot", "Claude-User", "PerplexityBot", "Bingbot"];

interface Rule {
  allow: boolean;
  pattern: string;
}

interface Group {
  agents: string[];
  rules: Rule[];
}

export interface Robots {
  groups: Group[];
  sitemaps: string[];
}

export function parseRobots(text: string): Robots {
  const groups: Group[] = [];
  const sitemaps: string[] = [];
  let current: Group | null = null;
  let lastWasAgent = false;

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, "").trim();
    if (!line) continue;
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();

    if (key === "user-agent") {
      if (!current || !lastWasAgent) {
        current = { agents: [], rules: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
      continue;
    }
    lastWasAgent = false;
    if (key === "sitemap") {
      sitemaps.push(value);
    } else if ((key === "allow" || key === "disallow") && current) {
      // An empty Disallow means "allow everything" and adds no rule.
      if (value === "" && key === "disallow") continue;
      current.rules.push({ allow: key === "allow", pattern: value });
    }
  }
  return { groups, sitemaps };
}

function groupFor(robots: Robots, userAgent: string): Group | undefined {
  const ua = userAgent.toLowerCase();
  // Most specific product-token match; fall back to "*".
  let best: Group | undefined;
  let bestLen = -1;
  for (const g of robots.groups) {
    for (const a of g.agents) {
      if (a !== "*" && ua.includes(a) && a.length > bestLen) {
        best = g;
        bestLen = a.length;
      }
    }
  }
  if (best) return best;
  return robots.groups.find((g) => g.agents.includes("*"));
}

function patternToRegex(pattern: string): RegExp {
  const anchored = pattern.endsWith("$");
  const body = (anchored ? pattern.slice(0, -1) : pattern)
    .split("*")
    .map((s) => s.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
    .join(".*");
  return new RegExp("^" + body + (anchored ? "$" : ""));
}

export function isAllowed(robots: Robots, userAgent: string, path: string): boolean {
  const group = groupFor(robots, userAgent);
  if (!group) return true;
  let match: Rule | undefined;
  let matchLen = -1;
  for (const rule of group.rules) {
    if (patternToRegex(rule.pattern).test(path)) {
      const len = rule.pattern.length;
      if (len > matchLen || (len === matchLen && rule.allow)) {
        match = rule;
        matchLen = len;
      }
    }
  }
  return match ? match.allow : true;
}

export function aiBotAccess(robots: Robots): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  for (const bot of AI_BOTS) out[bot] = !isAllowed(robots, bot, "/");
  return out;
}
