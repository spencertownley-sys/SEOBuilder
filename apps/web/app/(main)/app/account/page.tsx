import type { Metadata } from "next";
import { Messages } from "@/components/messages";
import { SubmitButton } from "@/components/submit-button";
import { requireUser } from "@/lib/session";
import { deleteAccountAction, logOutEverywhereAction } from "@/app/actions";

export const metadata: Metadata = { title: "Account" };

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ error?: string; notice?: string }> }) {
  const user = await requireUser();
  const { error, notice } = await searchParams;
  return (
    <div className="mx-auto max-w-xl space-y-6">
      <h1 className="text-3xl font-bold">Account</h1>
      <Messages error={error} notice={notice} />

      <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="font-semibold">Signed in as</h2>
        <p className="break-all text-slate-700">{user.email}</p>
        <form action={logOutEverywhereAction}>
          <SubmitButton variant="secondary" pending="Logging out…">
            Log out of all devices
          </SubmitButton>
        </form>
      </section>

      <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="font-semibold">Download my data</h2>
        <p className="text-sm text-slate-600">
          A JSON file with your account, sites, business details, competitors, tracked prompts, AI answers, tasks and score history.
        </p>
        <a href="/app/account/export" download className="inline-block rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-ink hover:bg-slate-50">
          Download my data
        </a>
      </section>

      <section className="space-y-3 rounded-xl border border-rose-200 bg-white p-6">
        <h2 className="font-semibold text-rose-800">Delete my account</h2>
        <p className="text-sm text-slate-600">
          This permanently deletes your account, every saved site, its crawls, tasks, tracked prompts and AI answers. It can&apos;t be undone.
          Download your data first if you want a copy.
        </p>
        <form action={deleteAccountAction} className="space-y-3">
          <label className="block space-y-1">
            <span className="text-sm font-medium">Type your email to confirm</span>
            <input name="confirm" type="email" required autoComplete="off" className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2" />
          </label>
          <SubmitButton variant="danger" pending="Deleting…">
            Delete my account
          </SubmitButton>
        </form>
      </section>
    </div>
  );
}
