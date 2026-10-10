// AI visibility metrics (PRD P0): mention rate, citation rate, average position, share of
// voice and sentiment — per engine and overall — each with its sample size, and rates with a
// 95% Wilson interval (PRD: "report a confidence range rather than one number").

import type { AIMention } from "./analyze.js";
import type { EngineId } from "./engines.js";

export interface AnswerRecord {
  prompt: string;
  engine: EngineId;
  model: string;
  runAt: string;
  mentions: AIMention[];
}

export interface Rate {
  value: number;
  low: number;
  high: number;
  n: number;
}

export interface VisibilityMetrics {
  answers: number;
  mentionRate: Rate;
  citationRate: Rate;
  averagePosition: number | null;
  /** Brand mentions ÷ all tracked-entity mentions. */
  shareOfVoice: number;
  sentiment: { positive: number; neutral: number; negative: number };
  /** Share of voice per entity, brand included. */
  competitors: { entity: string; mentions: number; shareOfVoice: number }[];
  firstRun: string | null;
  lastRun: string | null;
}

export function wilson(successes: number, n: number, z = 1.96): Rate {
  if (n === 0) return { value: 0, low: 0, high: 0, n: 0 };
  const p = successes / n;
  const denom = 1 + (z * z) / n;
  const center = (p + (z * z) / (2 * n)) / denom;
  const half = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / denom;
  const r = (x: number) => Math.round(x * 1000) / 1000;
  return { value: r(p), low: r(Math.max(0, center - half)), high: r(Math.min(1, center + half)), n };
}

export function computeVisibility(records: AnswerRecord[]): VisibilityMetrics {
  const brand = records.map((r) => r.mentions.find((m) => m.isBrand)).filter((m): m is AIMention => !!m);
  const mentioned = brand.filter((m) => m.mentioned);
  const positions = mentioned.map((m) => m.position).filter((p): p is number => p !== null);

  const totals = new Map<string, number>();
  for (const r of records) for (const m of r.mentions) if (m.mentioned) totals.set(m.entity, (totals.get(m.entity) ?? 0) + 1);
  const allMentions = [...totals.values()].reduce((a, b) => a + b, 0);
  const brandName = brand[0]?.entity;

  const sentiment = { positive: 0, neutral: 0, negative: 0 };
  for (const m of mentioned) if (m.sentiment) sentiment[m.sentiment]++;

  const runs = records.map((r) => r.runAt).sort();
  return {
    answers: records.length,
    mentionRate: wilson(mentioned.length, brand.length),
    citationRate: wilson(brand.filter((m) => m.citedUrls.length > 0).length, brand.length),
    averagePosition: positions.length ? Math.round((positions.reduce((a, b) => a + b, 0) / positions.length) * 10) / 10 : null,
    shareOfVoice: allMentions ? Math.round(((brandName ? (totals.get(brandName) ?? 0) : 0) / allMentions) * 1000) / 1000 : 0,
    sentiment,
    competitors: [...totals.entries()]
      .map(([entity, n]) => ({ entity, mentions: n, shareOfVoice: allMentions ? Math.round((n / allMentions) * 1000) / 1000 : 0 }))
      .sort((a, b) => b.mentions - a.mentions),
    firstRun: runs[0] ?? null,
    lastRun: runs[runs.length - 1] ?? null,
  };
}

export function visibilityByEngine(records: AnswerRecord[]): Record<string, VisibilityMetrics> {
  const out: Record<string, VisibilityMetrics> = {};
  for (const engine of new Set(records.map((r) => r.engine))) out[engine] = computeVisibility(records.filter((r) => r.engine === engine));
  return out;
}

/** Third-party domains the engines cite most for this prompt set (PRD P1 "source analysis"). */
export function topCitedDomains(answers: { citedUrls: string[] }[], limit = 15): { domain: string; citations: number }[] {
  const counts = new Map<string, number>();
  for (const a of answers)
    for (const u of new Set(a.citedUrls)) {
      try {
        const d = new URL(u).hostname.replace(/^www\./, "");
        counts.set(d, (counts.get(d) ?? 0) + 1);
      } catch {
        /* skip */
      }
    }
  return [...counts.entries()].map(([domain, citations]) => ({ domain, citations })).sort((a, b) => b.citations - a.citations).slice(0, limit);
}
