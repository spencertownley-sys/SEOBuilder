export function AuditForm({ defaultUrl = "" }: { defaultUrl?: string }) {
  return (
    <form action="/audit" method="get" className="flex max-w-2xl flex-col gap-3 sm:flex-row">
      <label htmlFor="url" className="sr-only">
        Website address
      </label>
      <input
        id="url"
        name="url"
        type="text"
        required
        defaultValue={defaultUrl}
        placeholder="yourbusiness.com"
        className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-4 py-3 text-base outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
      />
      <button type="submit" className="rounded-lg bg-ink px-6 py-3 font-semibold text-white hover:bg-ink/90">
        Run free audit
      </button>
    </form>
  );
}
