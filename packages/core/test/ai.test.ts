import { describe, expect, it } from "vitest";
import { analyzeAnswer, checkFacts, entitiesOf } from "../src/ai/analyze.js";
import type { Engine, EngineAnswer } from "../src/ai/engines.js";
import { computeVisibility, wilson } from "../src/ai/metrics.js";
import { suggestPrompts, type BrandProfile } from "../src/ai/prompts.js";
import { trackVisibility } from "../src/ai/runner.js";
import { computeScores } from "../src/audit/scoring.js";

const profile: BrandProfile = {
  name: "Example Studio",
  domain: "examplestudio.com",
  businessType: "wedding photographer",
  services: ["elopement photography"],
  locations: ["Tacoma"],
  competitors: [
    { name: "Rival Photo", domain: "rivalphoto.com" },
    { name: "Third Co" },
  ],
};

const answer = (text: string, citedUrls: string[] = []): EngineAnswer => ({ engine: "claude", model: "m", text, citedUrls, runAt: "2026-10-08T00:00:00Z" });

describe("prompt suggestions", () => {
  it("covers every intent and respects the cap", () => {
    const ps = suggestPrompts(profile, 12);
    expect(ps).toHaveLength(12);
    expect(new Set(ps.map((p) => p.intent))).toEqual(new Set(["discovery", "pricing", "how-to", "comparison", "brand"]));
    expect(ps.some((p) => p.text === "best wedding photographer in Tacoma")).toBe(true);
  });
});

describe("answer analysis", () => {
  it("finds mentions, order, citations and sentiment", () => {
    const m = analyzeAnswer(
      answer("Top picks: Rival Photo is popular. Example Studio is highly recommended for elopements. Avoid Third Co, which has complaints.", [
        "https://www.examplestudio.com/pricing",
        "https://theknot.com/x",
      ]),
      entitiesOf(profile),
    );
    const by = Object.fromEntries(m.map((x) => [x.entity, x]));
    expect(by["Rival Photo"]!.position).toBe(1);
    expect(by["Example Studio"]!.position).toBe(2);
    expect(by["Example Studio"]!.citedUrls).toEqual(["https://www.examplestudio.com/pricing"]);
    expect(by["Example Studio"]!.sentiment).toBe("positive");
    expect(by["Third Co"]!.sentiment).toBe("negative");
  });

  it("does not match names inside other words", () => {
    const m = analyzeAnswer(answer("The Third Company is unrelated."), entitiesOf(profile));
    expect(m.find((x) => x.entity === "Third Co")!.mentioned).toBe(false);
  });

  it("flags facts that contradict the brand's own", () => {
    expect(checkFacts("Example Studio's starting price is $1,200.", { "starting price": "$1,800" })).toHaveLength(1);
    expect(checkFacts("Their starting price is $1,800.", { "starting price": "$1,800" })).toHaveLength(0);
  });
});

describe("metrics", () => {
  it("computes Wilson intervals", () => {
    const r = wilson(5, 10);
    expect(r.value).toBe(0.5);
    expect(r.low).toBeCloseTo(0.237, 2);
    expect(r.high).toBeCloseTo(0.763, 2);
    expect(wilson(0, 0).n).toBe(0);
  });

  it("aggregates mention rate and share of voice", () => {
    const ents = entitiesOf(profile);
    const recs = ["Example Studio and Rival Photo", "Rival Photo only", "Nobody relevant", "Example Studio"].map((t) => ({
      prompt: t,
      engine: "claude" as const,
      model: "m",
      runAt: "2026-10-08T00:00:00Z",
      mentions: analyzeAnswer(answer(t), ents),
    }));
    const v = computeVisibility(recs);
    expect(v.mentionRate.value).toBe(0.5);
    expect(v.shareOfVoice).toBe(0.5);
    expect(v.averagePosition).toBe(1);
  });
});

describe("runner", () => {
  it("runs prompts × engines × repeats with a fake engine and raises gap issues", async () => {
    const fake: Engine = {
      id: "chatgpt",
      model: "fake",
      available: () => true,
      ask: async (p) => ({ ...answer(p.includes("vs") ? "Example Studio vs Rival Photo: both fine." : "Try Rival Photo.", ["https://theknot.com/a"]), engine: "chatgpt" }),
    };
    const prompts = suggestPrompts(profile, 6);
    const run = await trackVisibility(profile, prompts, [fake], { repeats: 2 });
    expect(run.records).toHaveLength(12);
    const types = run.issues.map((i) => i.type);
    expect(types).toEqual(expect.arrayContaining(["ai-competitor-gap", "ai-source-opportunities"]));
    // Mentioned in a third of answers: not "absent".
    expect(types).not.toContain("ai-absent-chatgpt");
    expect(run.topSources[0]).toEqual({ domain: "theknot.com", citations: 12 });
  });

  it("flags an engine that never mentions the brand", async () => {
    const never: Engine = { id: "gemini", model: "fake", available: () => true, ask: async () => ({ ...answer("Try Rival Photo."), engine: "gemini" }) };
    const run = await trackVisibility(profile, suggestPrompts(profile, 10), [never]);
    expect(run.issues.map((i) => i.type)).toContain("ai-absent-gemini");
  });

  it("blends tracked visibility into the AI score as the sample grows", () => {
    const readinessOnly = computeScores([]);
    expect(readinessOnly.aiVisibility).toBe(100);
    const tracked = computeScores([], { mentionRate: 0.1, citationRate: 0, sampleSize: 60 });
    expect(tracked.aiVisibility).toBeLessThan(40);
  });
});
