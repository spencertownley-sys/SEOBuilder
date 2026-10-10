import Link from "next/link";
import { notFound } from "next/navigation";
import { NotFoundError, requireSite } from "@seobuilder/platform";
import { requireUser } from "@/lib/session";
import { SiteTabs } from "./tabs";

export default async function SiteLayout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const site = await requireSite(user.id, id).catch((e) => {
    if (e instanceof NotFoundError) notFound();
    throw e;
  });
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Link href="/app" className="text-sm text-slate-500 hover:text-ink">
          ← All sites
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-3xl font-bold">{site.name}</h1>
          {site.verified_at ? (
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">Verified</span>
          ) : (
            <Link href={`/app/sites/${site.id}/settings#verify`} className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800">
              Not verified
            </Link>
          )}
        </div>
        <a href={site.url} target="_blank" rel="noopener noreferrer" className="text-sm text-slate-500 underline decoration-slate-300">
          {site.url}
        </a>
      </div>
      <SiteTabs siteId={site.id} />
      {children}
    </div>
  );
}
