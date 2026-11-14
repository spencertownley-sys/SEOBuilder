import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { startAudit } from "@/app/actions";
import { SubmitButton } from "@/components/submit-button";

export const metadata: Metadata = { title: "Run a free audit", robots: { index: false, follow: false } };

// Links like /audit?url=example.com (the betterseobuilder.com form, old bookmarks) only show
// this confirmation. The crawl starts when the visitor presses the button, through the
// startAudit server action, so a link, an <img> or a search crawler can't queue audits.
export default async function AuditConfirm({ searchParams }: { searchParams: Promise<{ url?: string }> }) {
  const { url } = await searchParams;
  const target = url?.trim().slice(0, 2048);
  if (!target) redirect("/");
  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">Run a free audit</h1>
        <p className="text-slate-600">We will crawl up to 50 pages of this site and build your fix list. It takes a minute or two.</p>
      </div>
      <form action={startAudit} className="space-y-4 rounded-xl border border-slate-200 bg-white p-6">
        <input type="hidden" name="url" value={target} />
        <p className="text-sm text-slate-500">Website</p>
        <p className="break-all text-lg font-semibold">{target}</p>
        <SubmitButton pending="Starting…" className="px-6 py-3 text-base">
          Run free audit
        </SubmitButton>
      </form>
    </div>
  );
}
