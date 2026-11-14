import type { Metadata } from "next";
import Link from "next/link";
import { Messages } from "@/components/messages";
import { SubmitButton } from "@/components/submit-button";
import { forgotPasswordAction } from "@/app/actions";

export const metadata: Metadata = { title: "Reset your password", alternates: { canonical: "/forgot" } };

export default async function ForgotPage({ searchParams }: { searchParams: Promise<{ error?: string; notice?: string }> }) {
  const { error, notice } = await searchParams;
  return (
    <div className="mx-auto max-w-sm space-y-6">
      <h1 className="text-2xl font-bold">Reset your password</h1>
      <Messages error={error} notice={notice} />
      <form action={forgotPasswordAction} className="space-y-4">
        <label className="block space-y-1">
          <span className="text-sm font-medium">Email</span>
          <input name="email" type="email" required autoComplete="email" className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2" />
        </label>
        <SubmitButton className="w-full py-2.5" pending="Sending…">
          Email me a reset link
        </SubmitButton>
      </form>
      <p className="text-sm text-slate-600">
        Remembered it?{" "}
        <Link href="/login" className="font-medium text-accent">
          Log in
        </Link>
      </p>
    </div>
  );
}
