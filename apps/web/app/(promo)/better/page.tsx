import type { Metadata } from "next";
import { ScrollScrub, type ScrollScrubScene } from "@/components/scroll-scrub/scroll-scrub";

// Advertising landing page served at betterseobuilder.com (see proxy.ts). Every call to
// action sends people to the Mentionful app; the free audit form posts straight to it.
const APP_URL = process.env.APP_URL ?? "https://mentionful.com";
const SITE_URL = "https://betterseobuilder.com";

export const metadata: Metadata = {
  title: "Better SEO Builder: be found by people and by AI",
  description:
    "Free SEO + AI visibility audit. See whether Google and AI assistants like ChatGPT, Claude, Gemini and Perplexity can find and recommend you, then fix what matters first.",
  alternates: { canonical: SITE_URL },
  openGraph: {
    title: "Be found by people. And by AI.",
    description: "Free SEO + AI visibility audit with a ranked, plain-English fix list. Powered by Mentionful.",
    url: SITE_URL,
    siteName: "Better SEO Builder",
    images: [{ url: `${SITE_URL}/better/og.jpg`, width: 1200, height: 630, alt: "Be found by people. And by AI." }],
    type: "website",
  },
  twitter: { card: "summary_large_image", images: [`${SITE_URL}/better/og.jpg`] },
  icons: { icon: "/better/favicon.svg" },
};

function AuditForm({ id, compact }: { id: string; compact?: boolean }) {
  return (
    <form action={`${APP_URL}/audit`} method="get" className={`flex w-full flex-col gap-2 sm:flex-row ${compact ? "max-w-xl" : "max-w-2xl"}`}>
      <label htmlFor={id} className="sr-only">
        Your website
      </label>
      <input id={id} name="url" type="text" required placeholder="yourbusiness.com" className="url-input flex-1" autoComplete="url" />
      <button type="submit" className="btn-lime">
        Run my free audit →
      </button>
    </form>
  );
}

const W = "/better/world";

// One continuous film, cut into four consecutive clips so each chapter scrubs its own stretch.
const SCENES: ScrollScrubScene[] = [
  {
    id: "search-changed",
    label: "Search changed",
    kicker: "Search just split in two",
    title: "Google ranks you. AI recommends you.",
    body: "Your customers still Google. More of them now just ask ChatGPT, Claude, Gemini or Perplexity, and those answers name only a few businesses. Are you one of them?",
    poster: `${W}/scene-1.jpg`,
    clip: `${W}/scene-1.mp4`,
    mobilePoster: `${W}/scene-1-mobile.jpg`,
    mobileClip: `${W}/scene-1-mobile.mp4`,
    scroll: 1.6,
    actions: <AuditForm id="hero-url" compact />,
  },
  {
    id: "the-gap",
    label: "The gap",
    kicker: "The invisible problem",
    title: "Most sites are dark to AI.",
    body: "Blocked AI crawlers, pages that only render with JavaScript, no structured data, no clear answers to quote. You can't see it from your homepage. AI assistants can.",
    tags: ["AI crawler access", "Readable without JS", "Structured data", "Citable answers"],
    poster: `${W}/scene-2.jpg`,
    clip: `${W}/scene-2.mp4`,
    mobilePoster: `${W}/scene-2-mobile.jpg`,
    mobileClip: `${W}/scene-2-mobile.mp4`,
    scroll: 1.4,
  },
  {
    id: "one-audit",
    label: "One audit",
    kicker: "One audit. Both worlds.",
    title: "27 checks. Two minutes. One fix list.",
    body: "Technical SEO and AI readiness in a single crawl, scored 0–100, with every finding turned into a plain-English task ranked by impact for the least effort.",
    tags: ["Technical Health", "AI Visibility", "Drafted fixes"],
    poster: `${W}/scene-3.jpg`,
    clip: `${W}/scene-3.mp4`,
    mobilePoster: `${W}/scene-3-mobile.jpg`,
    mobileClip: `${W}/scene-3-mobile.mp4`,
    align: "right",
    scroll: 1.4,
  },
  {
    id: "light-up",
    label: "Light up",
    kicker: "Fix it. We re-check it.",
    title: "Become the answer.",
    body: "Mark a fix done and we re-crawl to confirm it. Track what AI assistants say about you every week, against your competitors.",
    poster: `${W}/scene-4.jpg`,
    clip: `${W}/scene-4.mp4`,
    mobilePoster: `${W}/scene-4-mobile.jpg`,
    mobileClip: `${W}/scene-4-mobile.mp4`,
    scroll: 1.6,
    actions: (
      <a href={`${APP_URL}/signup`} className="btn-lime">
        Start free with Mentionful →
      </a>
    ),
  },
];

const THEME = { background: "#07080b", ink: "#f5f7f2", muted: "#b4b9b0", accent: "#c6ff3d" };

const STATS = [
  ["27", "SEO + AI readiness checks"],
  ["4", "AI assistants tracked"],
  ["~2 min", "to your first fix list"],
  ["$0", "to start"],
];

const STEPS = [
  ["01", "Paste your site", "We crawl it like Google and like AI crawlers do: robots.txt, raw HTML, structured data, speed."],
  ["02", "Get one ranked plan", "Every issue becomes a task with why it matters, how to fix it, and a drafted fix: JSON-LD, robots.txt lines, FAQ blocks."],
  ["03", "Watch it move", "Mark tasks done to trigger a re-check. Weekly crawls and AI answer tracking show what your fixes changed."],
];

const ROWS = [
  ["Tells you if ChatGPT & co. recommend you", false, true],
  ["Plain-English fixes, ranked for you", false, true],
  ["Re-checks your fix automatically", false, true],
  ["Keyword tables for SEO specialists", true, false],
] as const;

export default function BetterSeoBuilder() {
  return (
    <>
      <header className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-[#07080b]/70 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-3">
          <a href={SITE_URL} className="flex items-baseline gap-2">
            <span className="display text-2xl tracking-wide">
              Better<span className="text-[var(--lime)]">SEO</span>Builder
            </span>
          </a>
          <div className="flex items-center gap-3 text-sm">
            <a href={`${APP_URL}/login`} className="hidden font-semibold text-[var(--muted)] hover:text-[var(--ink)] sm:inline">
              Log in
            </a>
            <a href={`${APP_URL}/`} className="btn-lime !min-h-10 !px-4 text-sm">
              Free audit
            </a>
          </div>
        </div>
      </header>

      <main>
        <ScrollScrub scenes={SCENES} theme={THEME} />

        <section aria-label="At a glance" className="border-y border-[var(--line)] bg-[var(--lime)] text-[#07080b]">
          <div className="overflow-hidden py-4">
            <div className="marquee" aria-hidden>
              {[0, 1].map((k) => (
                <div key={k} className="flex shrink-0 items-center">
                  {["Be found by people", "Be found by AI", "ChatGPT", "Claude", "Gemini", "Perplexity", "Google", "One fix list"].map((w) => (
                    <span key={w + k} className="display flex items-center px-6 text-3xl sm:text-4xl">
                      {w}
                      <span className="ml-12 text-[var(--coral)]">✦</span>
                    </span>
                  ))}
                </div>
              ))}
            </div>
            <p className="sr-only">Be found by people and by AI: Google, ChatGPT, Claude, Gemini and Perplexity, with one fix list.</p>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-5 py-24 sm:py-32">
          <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-3xl border border-[var(--line)] bg-[var(--line)] lg:grid-cols-4">
            {STATS.map(([n, l]) => (
              <div key={l} className="bg-[var(--bg)] p-8 sm:p-10">
                <dt className="sr-only">{l}</dt>
                <dd>
                  <span className="display block text-6xl text-[var(--lime)] sm:text-7xl">{n}</span>
                  <span className="mt-3 block text-sm font-semibold text-[var(--muted)] sm:text-base">{l}</span>
                </dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="mx-auto max-w-7xl px-5 pb-24 sm:pb-32">
          <h2 className="display max-w-4xl text-6xl sm:text-8xl">
            How it <span className="text-[var(--coral)]">works</span>
          </h2>
          <ol className="mt-14 grid gap-6 lg:grid-cols-3">
            {STEPS.map(([n, t, d]) => (
              <li key={n} className="group rounded-3xl border border-[var(--line)] bg-[var(--surface)] p-8 transition-colors hover:border-[var(--lime)]">
                <span className="display text-5xl text-[var(--lime)]">{n}</span>
                <h3 className="mt-6 text-2xl font-extrabold">{t}</h3>
                <p className="mt-3 leading-relaxed text-[var(--muted)]">{d}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="mx-auto max-w-7xl px-5 pb-24 sm:pb-32">
          <div className="grid gap-12 lg:grid-cols-[1fr_1.2fr] lg:items-center">
            <h2 className="display text-6xl sm:text-8xl">
              Old SEO tools were built for <span className="text-[var(--lime)]">one</span> search engine.
            </h2>
            <div className="overflow-hidden rounded-3xl border border-[var(--line)]">
              <table className="w-full text-left text-sm sm:text-base">
                <thead>
                  <tr className="bg-[var(--surface)]">
                    <th className="p-4 font-semibold text-[var(--muted)] sm:p-5" scope="col">
                      <span className="sr-only">Feature</span>
                    </th>
                    <th className="p-4 text-center font-semibold text-[var(--muted)] sm:p-5" scope="col">
                      Typical SEO suite
                    </th>
                    <th className="p-4 text-center font-extrabold text-[var(--lime)] sm:p-5" scope="col">
                      Better SEO Builder
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {ROWS.map(([label, them, us]) => (
                    <tr key={label} className="border-t border-[var(--line)]">
                      <th className="p-4 font-semibold sm:p-5" scope="row">
                        {label}
                      </th>
                      <td className="p-4 text-center sm:p-5">{them ? <span aria-label="Yes">✓</span> : <span className="text-[#5d635a]" aria-label="No">—</span>}</td>
                      <td className="p-4 text-center sm:p-5">
                        {us ? (
                          <span className="font-extrabold text-[var(--lime)]" aria-label="Yes">
                            ✓
                          </span>
                        ) : (
                          <span className="text-[#5d635a]" aria-label="No">
                            —
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="relative overflow-hidden border-t border-[var(--line)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`${W}/scene-4-end.jpg`} alt="" className="absolute inset-0 h-full w-full object-cover opacity-50" loading="lazy" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#07080b] via-[#07080b]/70 to-[#07080b]/40" />
          <div className="relative mx-auto flex max-w-7xl flex-col items-start gap-8 px-5 py-28 sm:py-40">
            <h2 className="display max-w-5xl text-7xl sm:text-9xl">
              Be the business AI <span className="text-[var(--lime)]">names.</span>
            </h2>
            <p className="max-w-xl text-lg text-[var(--muted)]">Free audit, no card, results in about two minutes. Save your site to track it every week.</p>
            <AuditForm id="final-url" />
          </div>
        </section>
      </main>

      <footer className="border-t border-[var(--line)]">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-5 py-10 text-sm text-[var(--muted)] sm:flex-row sm:items-center sm:justify-between">
          <p>
            Better SEO Builder is powered by{" "}
            <a href={APP_URL} className="font-semibold text-[var(--ink)] underline decoration-[var(--lime)] underline-offset-4">
              Mentionful
            </a>
            .
          </p>
          <p>Scores and impact are estimates, not guarantees of rankings or AI citations.</p>
        </div>
      </footer>
    </>
  );
}
