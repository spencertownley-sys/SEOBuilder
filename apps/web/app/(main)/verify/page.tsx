import type { Metadata } from "next";
import Link from "next/link";
import { SubmitButton } from "@/components/submit-button";
import { verifyEmailAction } from "@/app/actions";

export const metadata: Metadata = { title: "Confirm your email", robots: { index: false } };

// The emailed link only opens this page; the token is used when the button is pressed, so mail
// scanners that prefetch links can't spend it.
export default async function VerifyPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return (
    <div className="mx-auto max-w-sm space-y-6">
      <h1 className="text-2xl font-bold">Confirm your email</h1>
      {token ? (
        <form action={verifyEmailAction} className="space-y-4">
          <input type="hidden" name="token" value={token} />
          <p className="text-slate-600">One click and your account is ready.</p>
          <SubmitButton className="w-full py-2.5" pending="Confirming…">
            Confirm my email
          </SubmitButton>
        </form>
      ) : (
        <p className="text-slate-600">
          This link is missing its code. Open the link from your email again, or{" "}
          <Link href="/login" className="font-medium text-accent">
            log in
          </Link>{" "}
          to send a new one.
        </p>
      )}
    </div>
  );
}
