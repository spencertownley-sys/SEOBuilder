// Core Web Vitals via the PageSpeed Insights API (PRD P0). Works without a key at low volume;
// set PAGESPEED_API_KEY for production.

import type { Issue } from "../types.js";

export interface PageSpeedResult {
  url: string;
  strategy: "mobile" | "desktop";
  performance: number | null; // 0–100 lab score
  lcpMs: number | null;
  cls: number | null;
  inpMs: number | null; // field data, when Chrome UX Report has enough traffic
  error?: string;
}

const PSI = "https://www.googleapis.com/pagespeedonline/v5/runPagespeed";

export async function runPageSpeed(url: string, strategy: "mobile" | "desktop" = "mobile", apiKey = process.env.PAGESPEED_API_KEY): Promise<PageSpeedResult> {
  const q = new URLSearchParams({ url, strategy, category: "performance" });
  if (apiKey) q.set("key", apiKey);
  try {
    const res = await fetch(`${PSI}?${q}`, { signal: AbortSignal.timeout(60000) });
    if (!res.ok) return { url, strategy, performance: null, lcpMs: null, cls: null, inpMs: null, error: `PageSpeed API ${res.status}` };
    const j = (await res.json()) as any;
    const audits = j.lighthouseResult?.audits ?? {};
    const field = j.loadingExperience?.metrics ?? {};
    const perf = j.lighthouseResult?.categories?.performance?.score;
    return {
      url,
      strategy,
      performance: typeof perf === "number" ? Math.round(perf * 100) : null,
      lcpMs: field.LARGEST_CONTENTFUL_PAINT_MS?.percentile ?? audits["largest-contentful-paint"]?.numericValue ?? null,
      cls: field.CUMULATIVE_LAYOUT_SHIFT_SCORE ? field.CUMULATIVE_LAYOUT_SHIFT_SCORE.percentile / 100 : (audits["cumulative-layout-shift"]?.numericValue ?? null),
      inpMs: field.INTERACTION_TO_NEXT_PAINT?.percentile ?? null,
    };
  } catch (e) {
    return { url, strategy, performance: null, lcpMs: null, cls: null, inpMs: null, error: (e as Error).message };
  }
}

/** Google's "good" thresholds: LCP ≤ 2.5s, CLS ≤ 0.1, INP ≤ 200ms. */
export function pageSpeedIssues(r: PageSpeedResult): Issue[] {
  if (r.error) return [];
  const problems: string[] = [];
  if (r.lcpMs !== null && r.lcpMs > 2500) problems.push(`LCP ${(r.lcpMs / 1000).toFixed(1)}s (good is ≤ 2.5s)`);
  if (r.cls !== null && r.cls > 0.1) problems.push(`CLS ${r.cls.toFixed(2)} (good is ≤ 0.1)`);
  if (r.inpMs !== null && r.inpMs > 200) problems.push(`INP ${Math.round(r.inpMs)}ms (good is ≤ 200ms)`);
  if (!problems.length && (r.performance === null || r.performance >= 50)) return [];
  const poor = (r.performance ?? 100) < 50 || (r.lcpMs ?? 0) > 4000;
  return [
    {
      type: "core-web-vitals",
      module: "seo",
      severity: poor ? "critical" : "warning",
      title: `Speed up the ${r.strategy} homepage${r.performance !== null ? ` (performance ${r.performance}/100)` : ""}`,
      why: `Core Web Vitals are a Google ranking factor and slow pages lose visitors. ${problems.join("; ")}.`,
      steps: [
        "Compress and resize large images; serve WebP/AVIF.",
        "Defer non-critical JavaScript and third-party widgets.",
        "Reserve space for images and embeds so the layout doesn't shift.",
        "Re-test in PageSpeed Insights after each change.",
      ],
      impact: poor ? 4 : 3,
      effort: 3,
      confidence: 0.7,
      urls: [r.url],
    },
  ];
}
