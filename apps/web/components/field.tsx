export function Field({
  label,
  name,
  hint,
  defaultValue,
  required,
  placeholder,
  textarea,
  rows = 3,
}: {
  label: string;
  name: string;
  hint?: string;
  defaultValue?: string;
  required?: boolean;
  placeholder?: string;
  textarea?: boolean;
  rows?: number;
}) {
  const cls = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20";
  return (
    <label className="block space-y-1">
      <span className="text-sm font-medium">{label}</span>
      {textarea ? (
        <textarea name={name} defaultValue={defaultValue} required={required} placeholder={placeholder} rows={rows} className={cls} />
      ) : (
        <input name={name} defaultValue={defaultValue} required={required} placeholder={placeholder} className={cls} />
      )}
      {hint && <span className="block text-xs text-slate-500">{hint}</span>}
    </label>
  );
}
