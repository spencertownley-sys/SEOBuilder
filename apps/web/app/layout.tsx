import type { Metadata } from "next";
import Link from "next/link";
import { currentUser } from "@/lib/session";
import { logOutAction } from "./actions";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Rankwell: be found by people and by AI", template: "%s · Rankwell" },
  description: "A free SEO + AI visibility audit with a ranked, plain-English fix list, plus weekly tracking of how ChatGPT, Claude, Gemini and Perplexity talk about you.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser().catch(() => null);
  return (
    <html lang="en">
      <body className="min-h-screen">
        <header className="border-b border-slate-200 bg-white">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4">
            <Link href={user ? "/app" : "/"} className="text-lg font-semibold tracking-tight">
              Rankwell<span className="text-accent">.</span>
            </Link>
            <nav className="flex items-center gap-4 text-sm">
              {user ? (
                <>
                  <Link href="/app" className="font-medium text-slate-700 hover:text-ink">
                    Sites
                  </Link>
                  <span className="hidden text-slate-400 sm:inline">{user.email}</span>
                  <form action={logOutAction}>
                    <button type="submit" className="text-slate-600 hover:text-ink">
                      Log out
                    </button>
                  </form>
                </>
              ) : (
                <>
                  <Link href="/login" className="text-slate-700 hover:text-ink">
                    Log in
                  </Link>
                  <Link href="/signup" className="rounded-lg bg-ink px-3 py-1.5 font-semibold text-white hover:bg-ink/90">
                    Sign up free
                  </Link>
                </>
              )}
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-5xl px-4 py-10">{children}</main>
        <footer className="mx-auto max-w-5xl px-4 pb-10 text-xs text-slate-400">
          Scores and impact are estimates, not guarantees of rankings or AI citations. Our crawler identifies as SEOBuilderBot and obeys robots.txt.
        </footer>
      </body>
    </html>
  );
}
