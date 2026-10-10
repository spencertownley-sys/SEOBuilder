const KINDS = [
  ["service", "A service people hire or book", "photographer, dentist, plumber, agency"],
  ["store", "Products people buy", "online store, shop, brand"],
  ["publisher", "Content people read or follow", "news site, blog, newsletter, podcast"],
] as const;

export function KindField({ defaultValue = "service" }: { defaultValue?: string }) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">What do people come to you for?</legend>
      <p className="text-xs text-slate-500">This decides which questions we ask AI assistants on your behalf.</p>
      <div className="grid gap-2 sm:grid-cols-3">
        {KINDS.map(([value, label, eg]) => (
          <label key={value} className="flex cursor-pointer gap-2 rounded-lg border border-slate-300 bg-white p-3 text-sm has-[:checked]:border-accent has-[:checked]:bg-teal-50">
            <input type="radio" name="kind" value={value} defaultChecked={defaultValue === value} className="mt-0.5 accent-[var(--color-accent)]" />
            <span>
              <span className="block font-medium">{label}</span>
              <span className="block text-xs text-slate-500">{eg}</span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
