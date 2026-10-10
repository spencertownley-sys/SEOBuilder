import Link from "next/link";
import { Messages } from "@/components/messages";
import { AuditForm } from "@/components/audit-form";

export default async function Home({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <div className="space-y-12">
      <section className="space-y-4">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">Be found by people and by AI.</h1>
        <p className="max-w-2xl text-lg text-slate-600">
          Paste your website and get a free audit in a minute or two: how healthy your site is for Google, how ready it is for ChatGPT, Claude,
          Perplexity and Gemini, and the ten fixes that matter most, in plain English.
        </p>
        <Messages error={error} />
        <AuditForm />
      </section>
      <section className="grid gap-4 sm:grid-cols-3">
        {[
          ["Technical Health", "Broken links, titles, headings, redirects, sitemap and page speed."],
          ["AI Visibility", "Whether AI crawlers can read you, and whether AI answers mention and cite you."],
          ["One action plan", "Every finding becomes a task with why it matters, how to fix it, and a drafted fix where possible."],
        ].map(([t, d]) => (
          <div key={t} className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="font-semibold">{t}</h2>
            <p className="mt-1 text-sm text-slate-600">{d}</p>
          </div>
        ))}
      </section>
      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="text-xl font-bold">Track it every week, free</h2>
        <p className="mt-2 max-w-2xl text-slate-600">
          Create an account to save your site. We re-crawl weekly, show what changed, re-check your fixes when you mark them done, compare you with
          competitors, and track what AI assistants say about you for the questions your customers ask.
        </p>
        <Link href="/signup" className="mt-4 inline-block rounded-lg bg-ink px-5 py-2.5 font-semibold text-white hover:bg-ink/90">
          Create a free account
        </Link>
      </section>
    </div>
  );
}
