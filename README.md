# SEOBuilder — SEO + GEO platform

**Be found by people and by AI.** One workspace that tells a site owner how visible they are
in classic search (SEO) and in AI answers (GEO, generative engine optimization), and turns
everything it finds into a ranked, plain-English fix list. Working name in the UI: *Rankwell*.

- **Product spec:** [docs/PRD.md](docs/PRD.md) (snapshot of the planning doc)
- **How it's built:** [docs/architecture.md](docs/architecture.md)
- **What's done and what's next:** [docs/mvp-plan.md](docs/mvp-plan.md)
- **Every check it runs:** [docs/checks.md](docs/checks.md)

## What works today

- **Free site audit** (web + CLI): crawls up to 500 pages politely, checks robots.txt, AI crawler
  access (GPTBot, OAI-SearchBot, ClaudeBot, PerplexityBot, Google-Extended…), sitemap, broken
  links, redirects, titles, meta, headings, canonicals, alt text, thin and JavaScript-only
  pages, structured data, citability signals and Core Web Vitals. 27 rules in all.
- **Three scores** (0–100): Technical Health, Search Visibility (pending rank data), AI Visibility.
- **Action Plan**: every finding becomes a task with why, steps, affected URLs and, where
  possible, a drafted fix (robots.txt lines, LocalBusiness/FAQ JSON-LD, llms.txt), sorted by
  impact × confidence ÷ effort.
- **AI visibility tracking** (CLI): suggests 20–50 prompts by intent, asks ChatGPT, Claude,
  Gemini and Perplexity through their official APIs with web search on, and reports mention
  rate, citation rate, average position, share of voice and sentiment with 95% confidence
  ranges, plus the third-party sites the engines cite and any answers that contradict your
  brand facts.
- **Database schema** for the full PRD data model, with per-workspace row-level security.

## Quick start

Requires Node 20+.

```bash
npm install
npm run build        # builds packages/core, then the web app
npm test             # core test suite (crawler, rules, plan, GEO metrics)
```

Run the web app:

```bash
npm run dev          # http://localhost:3000, then enter any site
```

Run an audit from the terminal:

```bash
npm run audit -- example.com --pages 100        # add --json for machine output
```

Track AI visibility (needs at least one engine key in `.env` or the environment, see `.env.example`):

```bash
npm run geo -- examples/profile.json --suggest              # preview the prompt set, no API calls
npm run geo -- examples/profile.json --engines claude,chatgpt --repeats 2 --out run.json
```

Each answer is a paid API call with web search: prompts × engines × repeats. Start small.

## Layout

```
packages/core/       Engine: crawl/ (robots, fetcher, extractor, crawler), audit/ (rules,
                     PageSpeed, scoring, Action Plan), ai/ (engines, prompts, analysis,
                     metrics, runner), cli/ (seo-audit, geo-track)
apps/web/            Next.js + Tailwind free audit
supabase/migrations/ Postgres schema + RLS
docs/                PRD, architecture, MVP plan, check catalog
examples/            Sample brand profile for geo-track
```

## Principles (from the PRD)

No black-hat tactics, no ranking guarantees, impact shown as estimates, sample size and run
dates on every AI number, official APIs first, and a crawler that identifies itself, obeys
robots.txt and goes easy on small sites.
