import { requireSite } from "@seobuilder/platform";
import { Field } from "@/components/field";
import { KindField } from "@/components/kind-field";
import { Messages } from "@/components/messages";
import { SubmitButton } from "@/components/submit-button";
import { requireUser } from "@/lib/session";
import { deleteSiteAction, updateProfileAction, verifySiteAction } from "@/app/actions";

export const metadata = { title: "Site settings" };

export default async function Settings({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ notice?: string; error?: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const sp = await searchParams;
  const site = await requireSite(user.id, id);
  const facts = Object.entries(site.brand_facts ?? {})
    .map(([k, v]) => `${k}: ${v}`)
    .join("\n");
  return (
    <div className="max-w-2xl space-y-8">
      <Messages notice={sp.notice} error={sp.error} />

      <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-bold">Business profile</h2>
        <p className="text-sm text-slate-600">Used to suggest tracked questions and to recognize you and your competitors in AI answers.</p>
        <form action={updateProfileAction.bind(null, site.id)} className="space-y-4">
          <Field label="Business name" name="name" defaultValue={site.name} required />
          <Field label="Other names people use" name="aliases" defaultValue={site.aliases.join(", ")} hint="Comma-separated, e.g. a former name or abbreviation." />
          <KindField defaultValue={site.business_kind} />
          <Field label="Describe the business in a few words" name="businessType" defaultValue={site.business_type} />
          <Field label="Services, products or topics" name="services" defaultValue={site.services.join(", ")} hint="Comma-separated." />
          <Field label="Locations served" name="locations" defaultValue={site.locations.join(", ")} hint="Comma-separated." />
          <Field
            label="Brand facts"
            name="facts"
            textarea
            rows={4}
            defaultValue={facts}
            placeholder={"starting price: $250\nopening hours: 9am–6pm"}
            hint="One “label: value” per line. We flag AI answers that mention a label with a different value."
          />
          <SubmitButton>Save</SubmitButton>
        </form>
      </section>

      <section id="verify" className="space-y-3 rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-bold">Verify ownership</h2>
        {site.verified_at ? (
          <p className="text-sm text-emerald-700">Verified on {new Date(site.verified_at).toLocaleDateString()}.</p>
        ) : (
          <>
            <p className="text-sm text-slate-600">Add one of these, then click Verify.</p>
            <div className="space-y-2 text-sm">
              <p className="font-medium">Option 1: a meta tag in your homepage&apos;s &lt;head&gt;</p>
              <pre className="overflow-x-auto rounded-lg bg-slate-900 p-3 text-xs text-slate-100">{`<meta name="seobuilder-verification" content="${site.verification_token}">`}</pre>
              <p className="font-medium">Option 2: a DNS TXT record on {site.domain}</p>
              <pre className="overflow-x-auto rounded-lg bg-slate-900 p-3 text-xs text-slate-100">{`seobuilder-verification=${site.verification_token}`}</pre>
            </div>
            <form action={verifySiteAction.bind(null, site.id)}>
              <SubmitButton pending="Checking…">Verify</SubmitButton>
            </form>
          </>
        )}
      </section>

      <section className="space-y-3 rounded-xl border border-rose-200 bg-white p-6">
        <h2 className="text-lg font-bold text-rose-800">Delete site</h2>
        <p className="text-sm text-slate-600">Removes the site, its crawl history, tasks and AI answers. This can&apos;t be undone.</p>
        <form action={deleteSiteAction.bind(null, site.id)} className="flex flex-col gap-2 sm:flex-row">
          <input name="confirm" placeholder={`Type ${site.domain} to confirm`} className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          <SubmitButton variant="danger" pending="Deleting…">
            Delete site
          </SubmitButton>
        </form>
      </section>
    </div>
  );
}
