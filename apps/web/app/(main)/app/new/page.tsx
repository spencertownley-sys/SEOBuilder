import { Field } from "@/components/field";
import { KindField } from "@/components/kind-field";
import { Messages } from "@/components/messages";
import { SubmitButton } from "@/components/submit-button";
import { requireUser } from "@/lib/session";
import { createSiteAction } from "@/app/actions";

export const metadata = { title: "Add a site" };

export default async function NewSite({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  await requireUser();
  const { error } = await searchParams;
  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Add a site</h1>
        <p className="mt-1 text-slate-600">
          A few details about the business let us suggest the questions people ask AI assistants, and spot when competitors are named instead of you.
        </p>
      </div>
      <Messages error={error} />
      <form action={createSiteAction} className="space-y-4 rounded-xl border border-slate-200 bg-white p-6">
        <Field label="Website" name="url" required placeholder="yourbusiness.com" />
        <Field label="Business name" name="name" placeholder="Townley Photography" hint="How customers and AI assistants refer to you." />
        <KindField />
        <Field label="Describe the business in a few words" name="businessType" placeholder="portrait photographer" hint="How a customer would say it: “wedding photographer”, “coffee roaster”, “cruise news site”." />
        <Field label="Main services, products or topics" name="services" placeholder="headshots, real estate photography" hint="Comma-separated." />
        <Field label="Locations served" name="locations" placeholder="Seattle, Tacoma" hint="Comma-separated. Leave empty if you're not local." />
        <Field
          label="Up to 5 competitors"
          name="competitors"
          textarea
          placeholder={"Rival Studio | rivalstudio.com\nanother-competitor.com"}
          hint="One per line: a name, a website, or “Name | website”. With a website we also audit them for comparison."
        />
        <SubmitButton pending="Adding site…">Add site and start crawling</SubmitButton>
      </form>
    </div>
  );
}
