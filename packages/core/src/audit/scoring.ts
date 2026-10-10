// The three dashboard scores (0–100). Each issue deducts points scaled by its impact,
// confidence and severity, with diminishing returns so one bad area can't zero a score.

import type { Issue, Scores } from "../types.js";
import { GEO_READINESS_TYPES } from "./checks.js";

const SEVERITY_WEIGHT = { critical: 1, warning: 0.6, notice: 0.3 } as const;

function scoreFrom(issues: Issue[], scale: number): number {
  const penalty = issues.reduce((sum, i) => sum + i.impact * i.confidence * SEVERITY_WEIGHT[i.severity], 0);
  // 100 · e^(−penalty/scale): a single critical impact-5 issue costs ~30 points.
  return Math.round(100 * Math.exp(-penalty / scale));
}

export interface AiTrackingSummary {
  /** Overall mention rate across tracked prompts and engines, 0–1. */
  mentionRate: number;
  citationRate: number;
  /** Number of answers the rates are based on. */
  sampleSize: number;
}

export function computeScores(issues: Issue[], tracking?: AiTrackingSummary, searchVisibility?: number | null): Scores {
  const technicalIssues = issues.filter((i) => i.module !== "geo");
  const readinessIssues = issues.filter((i) => GEO_READINESS_TYPES.has(i.type));
  const technical = scoreFrom(technicalIssues, 14);
  const aiReadiness = scoreFrom(readinessIssues, 12);

  // AI Visibility = on-site readiness until there is tracked answer data, then mostly what the engines actually say.
  let aiVisibility = aiReadiness;
  if (tracking && tracking.sampleSize > 0) {
    const observed = 100 * (0.7 * tracking.mentionRate + 0.3 * tracking.citationRate);
    // Trust observations more as the sample grows (full weight from ~60 answers).
    const w = Math.min(0.8, tracking.sampleSize / 75);
    aiVisibility = Math.round(w * observed + (1 - w) * aiReadiness);
  }
  return { technical, search: searchVisibility ?? null, aiVisibility, aiReadiness };
}
