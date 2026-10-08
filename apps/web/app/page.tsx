import { AuditForm } from "./audit-form";

export default function Home() {
  return (
    <div className="space-y-10">
      <section className="space-y-4">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">Be found by people and by AI.</h1>
        <p className="max-w-2xl text-lg text-slate-600">
          Paste your website and get a free audit in a minute or two: how healthy your site is for Google, how ready it is
          for ChatGPT, Claude, Perplexity and Gemini, and the ten fixes that matter most, in plain English.
        </p>
        <AuditForm />
      </section>
      <section className="grid gap-4 sm:grid-cols-3">
        {[
          ["Technical Health", "Broken links, titles, headings, redirects, sitemap and speed."],
          ["Search Visibility", "Rankings and clicks once you connect Search Console."],
          ["AI Visibility", "Whether AI crawlers can read you, and whether AI answers mention you."],
        ].map(([t, d]) => (
          <div key={t} className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="font-semibold">{t}</h2>
            <p className="mt-1 text-sm text-slate-600">{d}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
