// The Action Plan engine (PRD: "Recommendations engine").
// priority = impact × confidence ÷ effort, with a boost for tasks that help SEO and GEO.

import { createHash } from "node:crypto";
import type { Issue, Task } from "../types.js";

export const BOTH_MODULE_BOOST = 1.25;

const SEVERITY_TIEBREAK = { critical: 0.02, warning: 0.01, notice: 0 } as const;

export function priorityOf(i: Pick<Issue, "impact" | "effort" | "confidence" | "module" | "severity">): number {
  const base = (i.impact * i.confidence) / Math.max(1, i.effort);
  const boosted = i.module === "both" ? base * BOTH_MODULE_BOOST : base;
  return Math.round((boosted + SEVERITY_TIEBREAK[i.severity]) * 100) / 100;
}

/** Stable id so a task keeps its status across re-crawls of the same site. */
export function taskId(siteOrigin: string, issueType: string): string {
  return createHash("sha1").update(`${siteOrigin}|${issueType}`).digest("hex").slice(0, 12);
}

export function buildActionPlan(siteOrigin: string, issues: Issue[]): Task[] {
  return issues
    .map((i) => ({ ...i, id: taskId(siteOrigin, i.type), priority: priorityOf(i), status: "todo" as const }))
    .sort((a, b) => b.priority - a.priority || b.impact - a.impact || a.effort - b.effort);
}

/**
 * Re-check after the user marks tasks Done (PRD workflow P0): carry statuses over from the
 * previous plan, close tasks whose issue no longer appears, and reopen "done" tasks whose
 * issue came back.
 */
export function reconcilePlan(previous: Task[], next: Task[]): { tasks: Task[]; fixed: Task[]; reopened: Task[] } {
  const prevById = new Map(previous.map((t) => [t.id, t]));
  const nextIds = new Set(next.map((t) => t.id));
  const reopened: Task[] = [];
  const tasks = next.map((t) => {
    const prev = prevById.get(t.id);
    if (!prev) return t;
    if (prev.status === "done") {
      reopened.push(t);
      return { ...t, status: "todo" as const };
    }
    return { ...t, status: prev.status };
  });
  const fixed = previous.filter((t) => !nextIds.has(t.id) && t.status !== "ignored").map((t) => ({ ...t, status: "done" as const }));
  return { tasks, fixed, reopened };
}
