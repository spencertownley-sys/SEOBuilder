// Turns one AI answer into AIMention rows (PRD data model): for the brand and each competitor,
// was it mentioned, at what position, which of its URLs were cited, and with what sentiment.
// Deterministic baseline; an LLM parser can replace extractSentiment/fact checks later.

import type { BrandProfile } from "./prompts.js";
import type { EngineAnswer } from "./engines.js";

export interface EntityRef {
  name: string;
  domain?: string;
  aliases?: string[];
  isBrand: boolean;
}

export interface AIMention {
  entity: string;
  isBrand: boolean;
  mentioned: boolean;
  /** 1 = first entity named in the answer; null when not mentioned. */
  position: number | null;
  citedUrls: string[];
  sentiment: "positive" | "neutral" | "negative" | null;
  factErrors: string[];
}

export function entitiesOf(p: BrandProfile): EntityRef[] {
  return [
    { name: p.name, domain: p.domain, aliases: p.aliases, isBrand: true },
    ...p.competitors.map((c) => ({ name: c.name, domain: c.domain, aliases: c.aliases, isBrand: false })),
  ];
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function firstIndex(text: string, e: EntityRef): number {
  const names = [e.name, ...(e.aliases ?? [])];
  if (e.domain) names.push(e.domain.replace(/^www\./, ""));
  let best = -1;
  for (const n of names) {
    if (!n.trim()) continue;
    const m = new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRe(n)}(?=$|[^\\p{L}\\p{N}])`, "iu").exec(text);
    if (m) {
      const idx = m.index + m[1]!.length;
      if (best === -1 || idx < best) best = idx;
    }
  }
  return best;
}

function domainMatches(url: string, domain: string): boolean {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    const d = domain.replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "");
    return host === d || host.endsWith(`.${d}`);
  } catch {
    return false;
  }
}

const POSITIVE = /\b(best|top|excellent|highly (?:rated|recommended)|recommend(?:ed)?|great|outstanding|trusted|reliable|popular|favorite|stands? out|well[- ]reviewed|award)/gi;
const NEGATIVE = /\b(avoid|complain(?:t|ts)?|poor|bad|worst|scam|overpriced|unreliable|negative reviews?|issues? with|problems? with|lawsuit|closed|not recommended)/gi;

/** Sentiment of the sentences that mention the entity. */
export function extractSentiment(text: string, e: EntityRef): "positive" | "neutral" | "negative" {
  const names = [e.name, ...(e.aliases ?? [])].map((n) => n.toLowerCase());
  const sentences = text.split(/(?<=[.!?])\s+|\n+/).filter((s) => names.some((n) => s.toLowerCase().includes(n)));
  let pos = 0;
  let neg = 0;
  for (const s of sentences) {
    pos += s.match(POSITIVE)?.length ?? 0;
    neg += s.match(NEGATIVE)?.length ?? 0;
  }
  if (neg > pos) return "negative";
  if (pos > 0) return "positive";
  return "neutral";
}

/**
 * Brand accuracy (PRD P1): flag answers that state a fact differently from the brand's own.
 * facts: e.g. { "starting price": "$350", "hours": "9am–6pm" }. Flags an answer that mentions a
 * fact's label near the brand but not its expected value.
 */
export function checkFacts(text: string, facts: Record<string, string>): string[] {
  const errors: string[] = [];
  const lower = text.toLowerCase();
  for (const [label, value] of Object.entries(facts)) {
    const at = lower.indexOf(label.toLowerCase());
    if (at === -1) continue;
    const window = lower.slice(Math.max(0, at - 150), at + 250);
    if (!window.includes(value.toLowerCase())) errors.push(`Answer mentions ${label} but not the correct value (${value})`);
  }
  return errors;
}

export function analyzeAnswer(answer: EngineAnswer, entities: EntityRef[], brandFacts?: Record<string, string>): AIMention[] {
  const found = entities
    .map((e) => ({ e, idx: firstIndex(answer.text, e) }))
    .filter((x) => x.idx >= 0)
    .sort((a, b) => a.idx - b.idx);
  const positionOf = new Map(found.map((x, i) => [x.e.name, i + 1]));

  return entities.map((e) => {
    const cited = e.domain ? answer.citedUrls.filter((u) => domainMatches(u, e.domain!)) : [];
    const mentioned = positionOf.has(e.name) || cited.length > 0;
    return {
      entity: e.name,
      isBrand: e.isBrand,
      mentioned,
      position: positionOf.get(e.name) ?? null,
      citedUrls: cited,
      sentiment: positionOf.has(e.name) ? extractSentiment(answer.text, e) : null,
      factErrors: e.isBrand && brandFacts && positionOf.has(e.name) ? checkFacts(answer.text, brandFacts) : [],
    };
  });
}
