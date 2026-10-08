#!/usr/bin/env node
// Usage: geo-track <profile.json> [--suggest] [--repeats 2] [--engines claude,chatgpt] [--max-prompts 20] [--out run.json]
// profile.json: a BrandProfile, optionally with "prompts": [{ text, intent, location }] and "facts": { label: value }.
import { readFileSync, writeFileSync } from "node:fs";
import { availableEngines, type EngineId } from "../ai/engines.js";
import { suggestPrompts, type BrandProfile, type TrackedPrompt } from "../ai/prompts.js";
import { trackVisibility } from "../ai/runner.js";

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith("--"));
const opt = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
if (!file) {
  console.error("Usage: geo-track <profile.json> [--suggest] [--repeats N] [--engines a,b] [--max-prompts N] [--out file]");
  process.exit(1);
}
const profile = JSON.parse(readFileSync(file, "utf8")) as BrandProfile & { prompts?: TrackedPrompt[]; facts?: Record<string, string> };
const maxPrompts = Number(opt("--max-prompts") ?? 20);
const prompts = (profile.prompts?.length ? profile.prompts : suggestPrompts(profile, maxPrompts)).slice(0, maxPrompts);

if (args.includes("--suggest")) {
  for (const p of prompts) console.log(`[${p.intent}] ${p.text}`);
  process.exit(0);
}
const engines = availableEngines(opt("--engines")?.split(",") as EngineId[] | undefined);
if (!engines.length) {
  console.error("No engines available. Set at least one of OPENAI_API_KEY, ANTHROPIC_API_KEY, GEMINI_API_KEY, PERPLEXITY_API_KEY.");
  process.exit(1);
}
const repeats = Number(opt("--repeats") ?? 1);
console.error(`Running ${prompts.length} prompts × ${engines.map((e) => e.id).join(", ")} × ${repeats} run(s)…`);
const run = await trackVisibility(profile, prompts, engines, {
  repeats,
  brandFacts: profile.facts,
  onAnswer: (d, t) => process.stderr.write(`\r${d}/${t} answers   `),
});
process.stderr.write("\n");
const pct = (x: number) => `${Math.round(x * 100)}%`;
const o = run.overall;
console.log(`\n${profile.name}: ${o.answers} answers, ${o.firstRun} → ${o.lastRun}`);
console.log(`  Mention rate   ${pct(o.mentionRate.value)} (95% CI ${pct(o.mentionRate.low)}–${pct(o.mentionRate.high)})`);
console.log(`  Citation rate  ${pct(o.citationRate.value)} (95% CI ${pct(o.citationRate.low)}–${pct(o.citationRate.high)})`);
console.log(`  Avg position   ${o.averagePosition ?? "—"}`);
console.log(`  Share of voice ${pct(o.shareOfVoice)}`);
for (const [e, m] of Object.entries(run.byEngine)) console.log(`  · ${e}: mentioned in ${pct(m.mentionRate.value)} of ${m.answers}`);
const failed = run.answers.filter((a) => a.error);
if (failed.length) console.log(`  (${failed.length} engine calls failed, e.g. ${failed[0]!.engine}: ${failed[0]!.error})`);
console.log("\nTop cited sources:");
run.topSources.forEach((s) => console.log(`  ${s.domain} (${s.citations})`));
console.log("\nIssues:");
run.issues.forEach((i) => console.log(`  - ${i.title}`));
const out = opt("--out");
if (out) writeFileSync(out, JSON.stringify(run, null, 2));
