// Shared building blocks for the policy pages (privacy, terms, cookies, bot), styled with the
// app tokens so they read like the rest of Mentionful.

export function LegalPage({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <article className="max-w-3xl space-y-8 leading-relaxed text-slate-700">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight text-ink">{title}</h1>
        <p className="text-sm text-slate-500">Last updated: {updated}</p>
      </header>
      {children}
    </article>
  );
}

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-xl font-semibold text-ink">{title}</h2>
      {children}
    </section>
  );
}

export function List({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="list-disc space-y-1.5 pl-5">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}

export function Table({ head, rows }: { head: string[]; rows: React.ReactNode[][] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table className="w-full text-left text-sm">
        <thead className="bg-slate-50 text-slate-600">
          <tr>
            {head.map((h) => (
              <th key={h} scope="col" className="px-4 py-2.5 font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-slate-200 align-top">
              {r.map((c, j) => (
                <td key={j} className="px-4 py-2.5">
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Information only the owner can supply. Kept visible on purpose until it is filled in. */
export function Placeholder({ children }: { children: React.ReactNode }) {
  return <mark className="rounded bg-amber-100 px-1 font-medium text-amber-900">[PLACEHOLDER: {children}]</mark>;
}

export const POLICY_UPDATED = "14 November 2026";
