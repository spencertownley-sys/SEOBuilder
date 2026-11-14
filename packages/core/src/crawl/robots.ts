// Minimal robots.txt parser (RFC 9309 matching: longest match wins, Allow wins ties,
// `*` wildcards and `$` anchors supported).
//
// robots.txt comes from sites anyone can submit for a free audit, so matching must stay cheap
// whatever the file says: no RegExp (a rule like `/*a*a*a*a*b` backtracks exponentially), and
// caps on rule length, rules per group and path length.

/** Rules longer than this are ignored. */
export const MAX_RULE_LENGTH = 512;
/** Rules kept per user-agent group; later ones are ignored. */
export const MAX_RULES_PER_GROUP = 500;
/** Paths are truncated to this many characters before matching. */
export const MAX_PATH_LENGTH = 2048;

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
      if (value.length > MAX_RULE_LENGTH || current.rules.length >= MAX_RULES_PER_GROUP) continue;
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

/**
 * Does a robots.txt path pattern match this path? `*` matches any run of characters and a
 * trailing `$` anchors the end; without `$` the pattern only has to match a prefix.
 * Two-pointer greedy matching that remembers the last `*`: O(pattern × path) at worst, never
 * exponential, no recursion.
 */
export function matchRule(pattern: string, path: string): boolean {
  const anchored = pattern.endsWith("$");
  const pat = anchored ? pattern.slice(0, -1) : pattern;
  let p = 0;
  let s = 0;
  let star = -1; // index in pat of the last `*` seen
  let mark = 0; // index in path where that `*` started matching
  while (s < path.length) {
    if (p < pat.length && pat[p] === "*") {
      star = p++;
      mark = s;
    } else if (p === pat.length && !anchored) {
      return true; // the whole pattern matched a prefix
    } else if (p < pat.length && pat[p] === path[s]) {
      p++;
      s++;
    } else if (star !== -1) {
      // Let the last `*` swallow one more character and retry from there.
      p = star + 1;
      s = ++mark;
    } else {
      return false;
    }
  }
  while (p < pat.length && pat[p] === "*") p++;
  return p === pat.length;
}

export function isAllowed(robots: Robots, userAgent: string, rawPath: string): boolean {
  const group = groupFor(robots, userAgent);
  if (!group) return true;
  const path = rawPath.length > MAX_PATH_LENGTH ? rawPath.slice(0, MAX_PATH_LENGTH) : rawPath;
  let match: Rule | undefined;
  let matchLen = -1;
  for (const rule of group.rules) {
    if (matchRule(rule.pattern, path)) {
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
