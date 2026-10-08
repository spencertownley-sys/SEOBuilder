// Runs a prompt set across engines (with repeats, for answer randomness), analyzes every
// answer and turns visibility gaps into Action Plan issues.

import type { Issue } from "../types.js";
import { analyzeAnswer, entitiesOf } from "./analyze.js";
import type { Engine, EngineAnswer } from "./engines.js";
import { computeVisibility, topCitedDomains, visibilityByEngine, type AnswerRecord, type VisibilityMetrics } from "./metrics.js";
import type { BrandProfile, TrackedPrompt } from "./prompts.js";

export interface TrackingRun {
  profile: BrandProfile;
  answers: (EngineAnswer & { prompt: string })[];
  records: AnswerRecord[];
  overall: VisibilityMetrics;
  byEngine: Record<string, VisibilityMetrics>;
  topSources: { domain: string; citations: number }[];
  issues: Issue[];
}

export interface TrackOptions {
  repeats?: number;
  concurrency?: number;
  brandFacts?: Record<string, string>;
  onAnswer?: (done: number, total: number) => void;
}

export async function trackVisibility(profile: BrandProfile, prompts: TrackedPrompt[], engines: Engine[], opts: TrackOptions = {}): Promise<TrackingRun> {
  const { repeats = 1, concurrency = 4, brandFacts, onAnswer } = opts;
  const jobs = prompts.flatMap((p) => engines.flatMap((e) => Array.from({ length: repeats }, () => ({ p, e }))));
  const answers: (EngineAnswer & { prompt: string })[] = [];
  let next = 0;
  async function worker() {
    while (next < jobs.length) {
      const { p, e } = jobs[next++]!;
      const a = await e.ask(p.text, { location: p.location });
      answers.push({ ...a, prompt: p.text });
      onAnswer?.(answers.length, jobs.length);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, jobs.length) }, worker));

  const entities = entitiesOf(profile);
  const ok = answers.filter((a) => !a.error && a.text);
  const records: AnswerRecord[] = ok.map((a) => ({
    prompt: a.prompt,
    engine: a.engine,
    model: a.model,
    runAt: a.runAt,
    mentions: analyzeAnswer(a, entities, brandFacts),
  }));
  const overall = computeVisibility(records);
  const byEngine = visibilityByEngine(records);
  const topSources = topCitedDomains(ok);
  return { profile, answers, records, overall, byEngine, topSources, issues: visibilityIssues(profile, records, byEngine, topSources) };
}

export function visibilityIssues(
  profile: BrandProfile,
  records: AnswerRecord[],
  byEngine: Record<string, VisibilityMetrics>,
  topSources: { domain: string; citations: number }[],
): Issue[] {
  const issues: Issue[] = [];
  if (!records.length) return issues;

  // Prompts where competitors appear and the brand doesn't: the clearest content gaps.
  const gapPrompts = new Map<string, string[]>();
  for (const r of records) {
    const brand = r.mentions.find((m) => m.isBrand);
    const rivals = r.mentions.filter((m) => !m.isBrand && m.mentioned).map((m) => m.entity);
    if (brand && !brand.mentioned && rivals.length) gapPrompts.set(r.prompt, [...new Set([...(gapPrompts.get(r.prompt) ?? []), ...rivals])]);
  }
  if (gapPrompts.size) {
    const list = [...gapPrompts.entries()].slice(0, 10);
    issues.push({
      type: "ai-competitor-gap",
      module: "geo",
      severity: "warning",
      title: `Competitors are named instead of you on ${gapPrompts.size} prompt${gapPrompts.size === 1 ? "" : "s"}`,
      why: "When AI assistants recommend competitors for a question, the page that answers that question best on your site is missing or not being found.",
      steps: [
        ...list.map(([p, rivals]) => `"${p}" → AI named ${rivals.join(", ")}. Create or strengthen a page that directly answers this.`),
        "Earn mentions on the third-party sites these engines cite (see the source list).",
      ],
      impact: 4,
      effort: 3,
      confidence: 0.6,
      urls: [],
    });
  }

  for (const [engine, m] of Object.entries(byEngine)) {
    // Upper 95% bound under 30%: 0 of 10 answers, or at most 1 of 20, qualifies.
    if (m.answers >= 10 && m.mentionRate.high < 0.3) {
      issues.push({
        type: `ai-absent-${engine}`,
        module: "geo",
        severity: "warning",
        title: `${engine} almost never mentions ${profile.name} (${Math.round(m.mentionRate.value * 100)}% of ${m.answers} answers)`,
        why: `Each engine draws on different sources. Being absent in ${engine} usually means its crawler can't reach you, or the sites it trusts don't mention you.`,
        steps: [
          `Confirm ${engine}'s crawler is allowed in robots.txt and your CDN.`,
          "Check which domains it cites for these prompts and get listed or mentioned there.",
        ],
        impact: 3,
        effort: 3,
        confidence: 0.5,
        urls: [],
      });
    }
  }

  const factErrors = records.flatMap((r) => r.mentions.filter((m) => m.isBrand).flatMap((m) => m.factErrors.map((e) => `${r.engine}: "${r.prompt}" — ${e}`)));
  if (factErrors.length) {
    issues.push({
      type: "ai-fact-errors",
      module: "geo",
      severity: "critical",
      title: `AI answers state ${factErrors.length} wrong fact${factErrors.length === 1 ? "" : "s"} about ${profile.name}`,
      why: "Wrong prices, hours or services in AI answers send customers away or set the wrong expectations.",
      steps: [
        ...factErrors.slice(0, 8),
        "Make the correct facts explicit and consistent on your site, Google Business Profile and directory listings, then re-check.",
      ],
      impact: 5,
      effort: 2,
      confidence: 0.6,
      urls: [],
    });
  }

  const brandDomain = profile.domain.replace(/^www\./, "");
  const third = topSources.filter((s) => !s.domain.endsWith(brandDomain)).slice(0, 8);
  if (third.length) {
    issues.push({
      type: "ai-source-opportunities",
      module: "geo",
      severity: "notice",
      title: "Get mentioned on the sites AI engines cite for your topic",
      why: "AI answers lean on a small set of third-party sources. Appearing there is often the fastest way into the answers.",
      steps: third.map((s) => `${s.domain}: cited ${s.citations} time${s.citations === 1 ? "" : "s"}. Look for a listing, review, guest post or press mention.`),
      impact: 3,
      effort: 4,
      confidence: 0.5,
      urls: [],
    });
  }
  return issues;
}
