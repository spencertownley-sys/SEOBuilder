// Fair-use limits. Each one can be tuned with an environment variable; they are read on every
// call so a change in Railway takes effect on the next request (and tests can adjust them).

function envNumber(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === "") return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

export const limits = {
  /** Saved sites per workspace. */
  sitesPerWorkspace: () => envNumber("MAX_SITES_PER_WORKSPACE", 3),
  /** Hours between AI prompt runs for one site. A request inside the window returns the latest run. */
  promptRunCooldownHours: () => envNumber("PROMPT_RUN_COOLDOWN_HOURS", 24),
  /** Prompt runs one workspace may start in 24 hours, across all its sites. */
  promptRunsPerWorkspacePerDay: () => envNumber("MAX_PROMPT_RUNS_PER_WORKSPACE_PER_DAY", 3),
  /** Prompt runs the whole service may start in 24 hours: a ceiling on the AI provider bill. */
  promptRunsPerDay: () => envNumber("MAX_PROMPT_RUNS_PER_DAY", 200),
};
