import type { Task, TaskStatus } from "@seobuilder/core";

export function scoreTone(value: number | null | undefined): string {
  if (value === null || value === undefined) return "text-slate-400";
  return value >= 80 ? "text-emerald-700" : value >= 50 ? "text-amber-700" : "text-rose-700";
}

export function ScoreCard({ label, value, note, delta }: { label: string; value: number | null; note: string; delta?: number | null }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className={`mt-1 text-4xl font-bold ${scoreTone(value)}`}>
        {value ?? "—"}
        {value !== null && <span className="text-lg font-medium text-slate-400">/100</span>}
      </p>
      {delta !== undefined && delta !== null && delta !== 0 && (
        <p className="mt-1 text-xs font-medium text-slate-600">
          <span aria-hidden>{delta > 0 ? "▲" : "▼"}</span> {delta > 0 ? "+" : ""}
          {delta} since the previous check
        </p>
      )}
      <p className="mt-2 text-xs text-slate-500">{note}</p>
    </div>
  );
}

const MODULE_LABEL = { seo: "SEO", geo: "AI", both: "SEO + AI" } as const;
const STATUS_LABEL: Record<TaskStatus, string> = { todo: "To do", in_progress: "In progress", done: "Done", ignored: "Ignored" };

export function TaskCard({
  task,
  rank,
  resolved,
  statusAction,
  defaultOpen,
}: {
  task: Task;
  rank?: number;
  resolved?: boolean;
  statusAction?: (formData: FormData) => Promise<void>;
  defaultOpen?: boolean;
}) {
  const muted = resolved || task.status === "ignored";
  return (
    <li className={`rounded-xl border border-slate-200 bg-white p-5 ${muted ? "opacity-70" : ""}`}>
      <div className="flex items-start gap-4">
        {rank !== undefined && (
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ink text-sm font-semibold text-white">{rank}</span>
        )}
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className={`font-semibold ${resolved ? "line-through decoration-slate-400" : ""}`}>{task.title}</h3>
            <span className="rounded-full bg-teal-50 px-2 py-0.5 text-xs font-medium text-accent">{MODULE_LABEL[task.module]}</span>
            {task.severity === "critical" && !resolved && <span className="rounded-full bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-700">Critical</span>}
            {resolved && <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">✓ Fixed, confirmed by re-check</span>}
          </div>
          <p className="text-sm text-slate-600">{task.why}</p>
          <p className="text-xs text-slate-500">
            Est. impact {task.impact}/5 · effort {task.effort}/5
          </p>
          <details className="text-sm" open={defaultOpen}>
            <summary className="cursor-pointer font-medium text-accent">How to fix it</summary>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-slate-700">
              {task.steps.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ol>
            {task.urls.length > 0 && (
              <div className="mt-3">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Affected</p>
                <ul className="mt-1 space-y-0.5 text-xs">
                  {task.urls.slice(0, 10).map((u) => (
                    <li key={u} className="truncate">
                      <a href={u} className="text-slate-600 underline decoration-slate-300 hover:text-ink" rel="nofollow noopener noreferrer" target="_blank">
                        {u}
                      </a>
                    </li>
                  ))}
                  {task.urls.length > 10 && <li className="text-slate-400">+{task.urls.length - 10} more</li>}
                </ul>
              </div>
            )}
            {task.draftFix && (
              <div className="mt-3">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Drafted fix</p>
                <pre className="mt-1 overflow-x-auto rounded-lg bg-slate-900 p-3 text-xs text-slate-100">{task.draftFix}</pre>
              </div>
            )}
          </details>
          {statusAction && !resolved && (
            <form action={statusAction} className="flex flex-wrap items-center gap-1.5 pt-1">
              <input type="hidden" name="taskId" value={task.id} />
              <span className="mr-1 text-xs text-slate-500">Status:</span>
              {(Object.keys(STATUS_LABEL) as TaskStatus[]).map((s) => (
                <button
                  key={s}
                  type="submit"
                  name="status"
                  value={s}
                  aria-pressed={task.status === s}
                  className={`rounded-full border px-2.5 py-1 text-xs font-medium ${
                    task.status === s ? "border-ink bg-ink text-white" : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {s === "done" ? "Done → re-check" : STATUS_LABEL[s]}
                </button>
              ))}
            </form>
          )}
        </div>
      </div>
    </li>
  );
}
