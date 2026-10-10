# Mentionful — SEO + GEO platform

**Be found by people and by AI.** One workspace that tells a site owner how visible they are
in classic search (SEO) and in AI answers (GEO, generative engine optimization), and turns
everything it finds into a ranked, plain-English fix list. The product is **Mentionful**
(mentionful.com); **betterseobuilder.com** is its advertising landing page.

- **Live:** https://mentionful.com (app) and https://betterseobuilder.com (landing page). Railway
  project `seobuilder`: the `web` service serves the app, the `landing` service (`SITE_MODE=landing`,
  no database) serves the landing page. Every push to `main` deploys both.
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
- **Accounts and saved sites**: sign up, add a site with its business profile and competitors,
  verify ownership, weekly automatic re-crawls with what's new and fixed, task statuses that
  trigger a re-check when you mark a fix done, score history, competitor comparison, and the AI
  visibility page (edit tracked questions, run them, read every answer).
- **Shareable free-audit reports**, rate-limited per visitor.

## Quick start

Requires Node 22 and a Postgres database.

```bash
npm install
npm run build                     # core, then platform, then the web app
export DATABASE_URL=postgres://localhost/seobuilder
npm run dev                       # http://localhost:3000; migrations apply on start
```

Tests: `npm test` runs the core suite and the platform integration suite. The platform suite
needs a disposable database in `TEST_DATABASE_URL` (it drops and recreates the `public` schema).

Deploying: the `Dockerfile` builds the whole workspace and `railway.json` points Railway at it
with a health check on `/api/health`. Set `DATABASE_URL`, and optionally the engine API keys
below, `REQUESTER_SALT` (hashes visitor IPs for rate limits) and `PAGESPEED_API_KEY`.

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
packages/platform/   Postgres, migrations, accounts, sites, job queue, scheduler
packages/core/       Engine: crawl/ (robots, fetcher, extractor, crawler), audit/ (rules,
                     PageSpeed, scoring, Action Plan), ai/ (engines, prompts, analysis,
                     metrics, runner), cli/ (seo-audit, geo-track)
apps/web/            Next.js + Tailwind app (free audit, dashboard) and worker startup
db/migrations/       Postgres schema
docs/                PRD, architecture, MVP plan, check catalog
examples/            Sample brand profile for geo-track
```

## Principles (from the PRD)

No black-hat tactics, no ranking guarantees, impact shown as estimates, sample size and run
dates on every AI number, official APIs first, and a crawler that identifies itself, obeys
robots.txt and goes easy on small sites.
