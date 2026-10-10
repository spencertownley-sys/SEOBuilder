import { startAudit } from "@/app/actions";
import { SubmitButton } from "@/components/submit-button";

export function AuditForm({ defaultUrl = "" }: { defaultUrl?: string }) {
  return (
    <form action={startAudit} className="flex max-w-2xl flex-col gap-3 sm:flex-row">
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
      <SubmitButton pending="Starting…" className="px-6 py-3 text-base">
        Run free audit
      </SubmitButton>
    </form>
  );
}
