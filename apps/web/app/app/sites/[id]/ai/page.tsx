import { engineStatus, latestPromptRun, listPrompts, MAX_PROMPTS_PER_RUN } from "@seobuilder/platform";
import { AutoRefresh } from "@/components/auto-refresh";
import { Messages } from "@/components/messages";
import { SubmitButton } from "@/components/submit-button";
import { pct, timeAgo } from "@/lib/format";
import { requireUser } from "@/lib/session";
import { addPromptAction, deletePromptAction, runPromptsAction, suggestPromptsAction, togglePromptAction } from "../../../../actions";

export const metadata = { title: "AI visibility" };

const ENGINE_NAME: Record<string, string> = { chatgpt: "ChatGPT", claude: "Claude", gemini: "Gemini", perplexity: "Perplexity" };
const INTENTS = ["discovery", "comparison", "how-to", "pricing", "brand"] as const;

interface Metrics {
  overall: { answers: number; mentionRate: { value: number; low: number; high: number }; citationRate: { value: number; low: number; high: number }; averagePosition: number | null; shareOfVoice: number; sentiment: Record<string, number>; competitors: { entity: string; mentions: number; shareOfVoice: number }[] };
  byEngine: Record<string, { answers: number; mentionRate: { value: number; low: number; high: number }; citationRate: { value: number } }>;
  topSources: { domain: string; citations: number }[];
}

export default async function AiVisibility({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ notice?: string; error?: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const sp = await searchParams;
  const [prompts, latest] = await Promise.all([listPrompts(user.id, id), latestPromptRun(user.id, id)]);
  const engines = engineStatus();
  const connected = engines.filter((e) => e.available);
  const running = latest?.run.status === "running";
  const m = latest?.run.status === "done" ? (latest.run.metrics as Metrics) : null;
  const activeCount = prompts.filter((p) => p.active).length;

  return (
    <div className="space-y-8">
      {running && <AutoRefresh ms={4000} />}
      <Messages notice={sp.notice} error={sp.error} />

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-xl">
            <h2 className="font-semibold">What AI assistants say about you</h2>
            <p className="mt-1 text-sm text-slate-600">
              We ask each connected assistant your tracked questions with web search on, then check whether it mentions you, cites your site, and who it names
              instead. Runs weekly; up to {MAX_PROMPTS_PER_RUN} active prompts per run. API answers can differ from what people see in the apps.
            </p>
          </div>
          <form action={runPromptsAction.bind(null, id)}>
            <SubmitButton pending="Starting…" className={running ? "pointer-events-none opacity-60" : ""}>
              {running ? "Running…" : "Run now"}
            </SubmitButton>
          </form>
        </div>
        <ul className="mt-4 flex flex-wrap gap-2 text-xs">
          {engines.map((e) => (
            <li key={e.id} className={`rounded-full border px-2.5 py-1 ${e.available ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-slate-200 bg-slate-50 text-slate-500"}`}>
              {e.available ? "●" : "○"} {ENGINE_NAME[e.id]} {e.available ? "connected" : "not connected"}
            </li>
          ))}
        </ul>
        {connected.length === 0 && (
          <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
            No AI engines are connected on this server yet. The operator adds API keys as environment variables ({engines.map((e) => e.envVar).join(", ")}); each engine with a key is tracked.
            Your on-site AI readiness score works without them.
          </p>
        )}
      </section>

      {running && (
        <p className="text-sm text-slate-600">
          <span className="mr-2 inline-block h-2 w-2 animate-pulse rounded-full bg-accent" />
          Asking {latest!.run.engines.map((e) => ENGINE_NAME[e] ?? e).join(", ")}… started {timeAgo(latest!.run.started_at)}.
        </p>
      )}
      {latest?.run.status === "failed" && <Messages error={`Last run failed: ${latest.run.error}`} />}

      {m && (
        <section className="space-y-4">
          <p className="text-sm text-slate-500">
            Last run {timeAgo(latest!.run.finished_at)} · {m.overall.answers} answers from {Object.keys(m.byEngine).map((e) => ENGINE_NAME[e] ?? e).join(", ")}
            {latest!.run.error ? ` · ${latest!.run.error}` : ""}
          </p>
          <div className="grid gap-4 sm:grid-cols-4">
            {[
              ["Mention rate", pct(m.overall.mentionRate.value), `95% range ${pct(m.overall.mentionRate.low)}–${pct(m.overall.mentionRate.high)}`],
              ["Citation rate", pct(m.overall.citationRate.value), `95% range ${pct(m.overall.citationRate.low)}–${pct(m.overall.citationRate.high)}`],
              ["Avg. position", m.overall.averagePosition ?? "—", "1 = named first"],
              ["Share of voice", pct(m.overall.shareOfVoice), "Your mentions vs competitors"],
            ].map(([l, v, n]) => (
              <div key={String(l)} className="rounded-xl border border-slate-200 bg-white p-4">
                <p className="text-xs text-slate-500">{l}</p>
                <p className="text-2xl font-bold">{v}</p>
                <p className="text-xs text-slate-500">{n}</p>
              </div>
            ))}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm">
              <h3 className="mb-2 font-semibold">By assistant</h3>
              <table className="w-full">
                <tbody>
                  {Object.entries(m.byEngine).map(([e, v]) => (
                    <tr key={e} className="border-t border-slate-100 first:border-0">
                      <td className="py-1.5">{ENGINE_NAME[e] ?? e}</td>
                      <td className="py-1.5 text-right">
                        mentioned in <span className="font-semibold">{pct(v.mentionRate.value)}</span> of {v.answers}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm">
              <h3 className="mb-2 font-semibold">Sites the assistants cite most</h3>
              {m.topSources.length === 0 ? (
                <p className="text-slate-500">No citations returned.</p>
              ) : (
                <ol className="space-y-1">
                  {m.topSources.slice(0, 8).map((s) => (
                    <li key={s.domain} className="flex justify-between gap-2">
                      <span className="truncate">{s.domain}</span>
                      <span className="text-slate-500">{s.citations}</span>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </div>
          <details className="rounded-xl border border-slate-200 bg-white p-4 text-sm">
            <summary className="cursor-pointer font-semibold">Every answer ({latest!.answers.length})</summary>
            <ul className="mt-3 space-y-3">
              {latest!.answers.map((a) => (
                <li key={a.id} className="border-t border-slate-100 pt-3">
                  <p className="font-medium">
                    “{a.prompt_text}” <span className="font-normal text-slate-500">· {ENGINE_NAME[a.engine] ?? a.engine}</span>
                  </p>
                  {a.error ? (
                    <p className="text-rose-700">Failed: {a.error}</p>
                  ) : (
                    <>
                      <p className="mt-1 text-xs">
                        {a.brand_mentioned ? (
                          <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-emerald-800">You: mentioned{a.brand_position ? `, #${a.brand_position}` : ""}{a.brand_sentiment ? `, ${a.brand_sentiment}` : ""}</span>
                        ) : (
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-600">You: not mentioned</span>
                        )}
                        {a.rivals?.length ? <span className="ml-2 text-slate-600">Competitors named: {a.rivals.join(", ")}</span> : null}
                      </p>
                      <p className="mt-1 line-clamp-4 whitespace-pre-line text-slate-600">{a.answer_text}</p>
                    </>
                  )}
                </li>
              ))}
            </ul>
          </details>
        </section>
      )}

      <section className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-xl font-bold">Tracked questions</h2>
          <span className="text-sm text-slate-500">
            {activeCount} active{activeCount > MAX_PROMPTS_PER_RUN ? ` (the first ${MAX_PROMPTS_PER_RUN} run each week)` : ""}
          </span>
        </div>
        <form action={addPromptAction.bind(null, id)} className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row">
          <input name="text" required placeholder="e.g. best headshot photographer in Seattle" className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          <select name="intent" className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" defaultValue="discovery" aria-label="Intent">
            {INTENTS.map((i) => (
              <option key={i} value={i}>
                {i}
              </option>
            ))}
          </select>
          <SubmitButton variant="secondary">Add</SubmitButton>
        </form>
        <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
          {prompts.map((p) => (
            <li key={p.id} className={`flex items-center gap-3 px-4 py-2.5 text-sm ${p.active ? "" : "text-slate-400"}`}>
              <span className="w-24 shrink-0 text-xs uppercase tracking-wide text-slate-500">{p.intent}</span>
              <span className="min-w-0 flex-1">{p.text}</span>
              <form action={togglePromptAction.bind(null, id)}>
                <input type="hidden" name="promptId" value={p.id} />
                <input type="hidden" name="active" value={p.active ? "0" : "1"} />
                <button className="text-xs font-medium text-accent">{p.active ? "Pause" : "Resume"}</button>
              </form>
              <form action={deletePromptAction.bind(null, id)}>
                <input type="hidden" name="promptId" value={p.id} />
                <button className="text-xs text-slate-500 hover:text-rose-700" aria-label={`Delete “${p.text}”`}>
                  Delete
                </button>
              </form>
            </li>
          ))}
        </ul>
        <form action={suggestPromptsAction.bind(null, id)}>
          <SubmitButton variant="secondary">Suggest more questions</SubmitButton>
        </form>
      </section>
    </div>
  );
}
