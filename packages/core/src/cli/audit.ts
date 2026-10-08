#!/usr/bin/env node
// Usage: seo-audit <url> [--pages 100] [--json] [--no-pagespeed]
import { runAudit } from "../audit/index.js";

const args = process.argv.slice(2);
const url = args.find((a) => !a.startsWith("--"));
if (!url) {
  console.error("Usage: seo-audit <url> [--pages N] [--json] [--no-pagespeed]");
  process.exit(1);
}
const pagesIdx = args.indexOf("--pages");
const maxPages = pagesIdx >= 0 ? Number(args[pagesIdx + 1]) : 100;
const json = args.includes("--json");

const result = await runAudit(url, {
  maxPages,
  pageSpeed: !args.includes("--no-pagespeed"),
  onProgress: (n, q) => !json && process.stderr.write(`\rcrawled ${n} pages, ${q} queued   `),
});
if (json) {
  console.log(JSON.stringify(result, null, 2));
  process.exit(0);
}
process.stderr.write("\n");
const { scores, tasks, site } = result;
console.log(`\n${site.origin} — ${site.pages.length} pages crawled${site.truncated ? " (page limit reached)" : ""}\n`);
console.log(`  Technical Health   ${scores.technical}/100`);
console.log(`  Search Visibility  ${scores.search ?? "— connect Search Console or add keywords"}`);
console.log(`  AI Visibility      ${scores.aiVisibility}/100 (on-site readiness; run geo-track for answer data)\n`);
console.log("Top fixes:");
tasks.slice(0, 10).forEach((t, i) => {
  console.log(`\n${i + 1}. [${t.module.toUpperCase()}] ${t.title}  (impact ${t.impact}, effort ${t.effort}, priority ${t.priority})`);
  console.log(`   Why: ${t.why}`);
  t.steps.forEach((s) => console.log(`   - ${s}`));
  if (t.urls.length) console.log(`   e.g. ${t.urls.slice(0, 3).join(", ")}${t.urls.length > 3 ? ` (+${t.urls.length - 3} more)` : ""}`);
});
console.log(`\n${tasks.length} tasks total. Impact estimates are estimates, not guarantees.`);
