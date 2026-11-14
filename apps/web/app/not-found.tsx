import type { Metadata } from "next";
import Link from "next/link";

// Shown for unknown URLs on mentionful.com. Next.js keeps the 404 status and adds
// <meta name="robots" content="noindex"> itself.
export const metadata: Metadata = { title: "Page not found · Mentionful" };

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center gap-6 px-4 py-16">
      <Link href="/" className="text-lg font-semibold tracking-tight text-ink">
        Mentionful<span className="text-accent">.</span>
      </Link>
      <div className="space-y-2">
        <p className="text-sm font-semibold text-accent">404</p>
        <h1 className="text-3xl font-bold text-ink">We couldn&apos;t find that page</h1>
        <p className="text-slate-600">The link may be old or mistyped. Here are some places to go instead.</p>
      </div>
      <div className="flex flex-wrap gap-3">
        <Link href="/" className="rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white hover:bg-ink/90">
          Run a free audit
        </Link>
        <Link href="/login" className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-ink hover:bg-slate-50">
          Log in
        </Link>
      </div>
    </main>
  );
}
