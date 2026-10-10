import { latestPromptRun, siteOverview } from "@seobuilder/platform";
import { AutoRefresh } from "@/components/auto-refresh";
import { Messages } from "@/components/messages";
import { scoreTone } from "@/components/report";
import { SubmitButton } from "@/components/submit-button";
import { pct, timeAgo } from "@/lib/format";
import { requireUser } from "@/lib/session";
import { addCompetitorAction, removeCompetitorAction } from "../../../../actions";

export const metadata = { title: "Competitors" };

export default async function Competitors({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ notice?: string; error?: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const sp = await searchParams;
  const [ov, latest] = await Promise.all([siteOverview(user.id, id), latestPromptRun(user.id, id)]);
  const mine = ov.scores.at(-1);
  const sov = new Map<string, number>(
    ((latest?.run.status === "done" ? (latest.run.metrics as { overall?: { competitors?: { entity: string; shareOfVoice: number }[] } })?.overall?.competitors : []) ?? []).map((c) => [c.entity, c.shareOfVoice]),
  );
  const hasSov = sov.size > 0;
  const pending = ov.competitors.some((c) => c.domain && !c.audited_at);

  const rows = [
    { key: "me", name: `${ov.site.name} (you)`, domain: ov.site.domain, technical: mine?.technical ?? null, ai: mine?.ai_readiness ?? null, sov: sov.get(ov.site.name), audited: ov.lastCrawl?.finished_at ?? null, you: true },
    ...ov.competitors.map((c) => ({ key: c.id, name: c.name, domain: c.domain, technical: c.scores?.technical ?? null, ai: c.scores?.aiReadiness ?? null, sov: sov.get(c.name), audited: c.audited_at, you: false })),
  ];

  return (
    <div className="space-y-6">
      {pending && <AutoRefresh ms={5000} />}
      <Messages notice={sp.notice} error={sp.error} />
      <p className="max-w-2xl text-sm text-slate-600">
        Competitors with a website get a lighter audit (30 pages) on the same scale. AI share of voice comes from your latest AI visibility run: how often each
        business is named across all answers.
      </p>
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full min-w-[560px] text-sm">
          <thead className="text-left text-xs text-slate-500">
            <tr>
              <th className="px-4 py-2 font-medium">Business</th>
              <th className="px-4 py-2 font-medium">Technical Health</th>
              <th className="px-4 py-2 font-medium">AI Readiness</th>
              <th className="px-4 py-2 font-medium">AI share of voice</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key} className={`border-t border-slate-100 ${r.you ? "bg-teal-50/50" : ""}`}>
                <td className="px-4 py-3">
                  <p className="font-medium">{r.name}</p>
                  <p className="text-xs text-slate-500">{r.domain ?? "no website given"}</p>
                </td>
                <td className={`px-4 py-3 text-lg font-bold ${scoreTone(r.technical)}`}>{r.technical ?? (r.domain && !r.audited ? <span className="text-xs font-normal text-slate-500">auditing…</span> : "—")}</td>
                <td className={`px-4 py-3 text-lg font-bold ${scoreTone(r.ai)}`}>{r.ai ?? "—"}</td>
                <td className="px-4 py-3">{hasSov ? pct(r.sov ?? 0) : <span className="text-xs text-slate-500">after an AI run</span>}</td>
                <td className="px-4 py-3 text-right">
                  {!r.you && (
                    <form action={removeCompetitorAction.bind(null, id)}>
                      <input type="hidden" name="competitorId" value={r.key} />
                      <button className="text-xs text-slate-500 hover:text-rose-700">Remove</button>
                    </form>
                  )}
                  {r.audited && <p className="text-xs text-slate-400">{timeAgo(r.audited)}</p>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {ov.competitors.length < 5 && (
        <form action={addCompetitorAction.bind(null, id)} className="flex max-w-xl flex-col gap-2 sm:flex-row">
          <input name="competitor" required placeholder="Name | competitor.com" className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" />
          <SubmitButton variant="secondary">Add competitor</SubmitButton>
        </form>
      )}
    </div>
  );
}
