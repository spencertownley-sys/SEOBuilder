import type { Metadata } from "next";
import Link from "next/link";
import { Messages } from "@/components/messages";
import { SubmitButton } from "@/components/submit-button";
import { resetPasswordAction } from "@/app/actions";

export const metadata: Metadata = { title: "Choose a new password", robots: { index: false } };

export default async function ResetPage({ searchParams }: { searchParams: Promise<{ token?: string; error?: string }> }) {
  const { token, error } = await searchParams;
  return (
    <div className="mx-auto max-w-sm space-y-6">
      <h1 className="text-2xl font-bold">Choose a new password</h1>
      <Messages error={error} />
      {token ? (
        <form action={resetPasswordAction} className="space-y-4">
          <input type="hidden" name="token" value={token} />
          <label className="block space-y-1">
            <span className="text-sm font-medium">New password</span>
            <input name="password" type="password" required minLength={8} maxLength={200} autoComplete="new-password" className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2" />
            <span className="text-xs text-slate-500">At least 8 characters. Every other device will be signed out.</span>
          </label>
          <SubmitButton className="w-full py-2.5" pending="Saving…">
            Save new password
          </SubmitButton>
        </form>
      ) : (
        <p className="text-slate-600">
          This link is missing its code.{" "}
          <Link href="/forgot" className="font-medium text-accent">
            Ask for a new reset link
          </Link>
          .
        </p>
      )}
    </div>
  );
}
