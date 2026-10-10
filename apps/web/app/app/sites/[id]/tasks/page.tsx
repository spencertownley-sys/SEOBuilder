import Link from "next/link";
import { listTasks, rowToTask } from "@seobuilder/platform";
import { Messages } from "@/components/messages";
import { TaskCard } from "@/components/report";
import { requireUser } from "@/lib/session";
import { setTaskStatusAction } from "../../../../actions";

const VIEWS = {
  open: { label: "Open", match: (t: { resolved: boolean; status: string }) => !t.resolved && (t.status === "todo" || t.status === "in_progress") },
  done: { label: "Done", match: (t: { resolved: boolean; status: string }) => t.resolved || t.status === "done" },
  ignored: { label: "Ignored", match: (t: { resolved: boolean; status: string }) => !t.resolved && t.status === "ignored" },
  all: { label: "All", match: () => true },
} as const;
const MODULES = { all: "All", seo: "SEO", geo: "AI", both: "SEO + AI" } as const;

export const metadata = { title: "Action plan" };

export default async function Tasks({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ view?: string; module?: string; notice?: string; error?: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const sp = await searchParams;
  const view = (sp.view && sp.view in VIEWS ? sp.view : "open") as keyof typeof VIEWS;
  const mod = (sp.module && sp.module in MODULES ? sp.module : "all") as keyof typeof MODULES;
  const all = await listTasks(user.id, id);
  const tasks = all.filter((t) => VIEWS[view].match(t) && (mod === "all" || t.module === mod));
  const base = `/app/sites/${id}/tasks`;
  const href = (v: string, m: string) => `${base}?view=${v}&module=${m}`;

  return (
    <div className="space-y-5">
      <Messages notice={sp.notice} error={sp.error} />
      <div className="flex flex-wrap items-center gap-2 text-sm">
        {Object.entries(VIEWS).map(([k, v]) => (
          <Link key={k} href={href(k, mod)} className={`rounded-full border px-3 py-1 ${view === k ? "border-ink bg-ink text-white" : "border-slate-300 bg-white"}`}>
            {v.label} ({all.filter(v.match).length})
          </Link>
        ))}
        <span className="mx-2 h-5 w-px bg-slate-300" aria-hidden />
        {Object.entries(MODULES).map(([k, v]) => (
          <Link key={k} href={href(view, k)} className={`rounded-full border px-3 py-1 ${mod === k ? "border-accent bg-teal-50 text-accent" : "border-slate-300 bg-white"}`}>
            {v}
          </Link>
        ))}
      </div>
      <p className="text-sm text-slate-500">
        Sorted by priority: impact × confidence ÷ effort, with a boost for fixes that help both search and AI. Marking a task Done re-checks the site; if the
        problem is still there, the task reopens.
      </p>
      {tasks.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">Nothing here.</p>
      ) : (
        <ol className="space-y-3">
          {tasks.map((t, i) => (
            <TaskCard
              key={t.id}
              task={rowToTask(t)}
              rank={view === "open" ? i + 1 : undefined}
              resolved={t.resolved}
              statusAction={setTaskStatusAction.bind(null, id, href(view, mod))}
            />
          ))}
        </ol>
      )}
    </div>
  );
}
