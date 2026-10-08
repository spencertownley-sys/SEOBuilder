# MVP build plan

PRD Phase 1 (10 weeks): site setup, technical audit, AI readiness audit, prompt sets + AI
answer tracking on 3 engines, Action Plan, three scores. This breaks it into shippable slices.
Status as of Oct 8, 2026.

| # | Slice | PRD items | Status |
| --- | --- | --- | --- |
| 1 | **Audit engine** — crawler, robots/sitemap, 27 SEO + GEO rules, PageSpeed, Action Plan, scores | Technical audit P0, AI readiness P0, Task scoring, Dashboards P0 (scores) | ✅ Done (`packages/core`) |
| 2 | **Free audit web flow** — URL in, 3 scores + top 10 fixes out, drafted fixes (robots.txt, JSON-LD, llms.txt) | Use case 1, Free plan | ✅ Done (`apps/web`) |
| 3 | **GEO tracking engine** — prompt suggestions by intent, 4 engine adapters, mention/citation/position/sentiment, Wilson intervals, source analysis, brand-fact checks, gap → task | Prompt sets P0, AI answer tracking P0, Source analysis P1, Brand accuracy P1 | ✅ Engine + CLI done; needs API keys to run live |
| 4 | **Data model** — Supabase schema with RLS | Core data model | ✅ Migration written and tested on Postgres 16 |
| 5 | **Accounts + sites** — Supabase auth, workspaces, add site, ownership verification (meta tag / DNS TXT), onboarding (business type, locations, services, competitors) | Site setup P0 | ⏭ Next |
| 6 | **Workers + persistence** — Railway worker runs crawls and prompt runs from a queue, writes results, weekly re-crawl with new/fixed diff | Scheduled re-crawls P1, Workflow P0 re-check | ⏭ |
| 7 | **Dashboard** — task list with status (To do / In progress / Done / Ignored), score trends (Recharts), competitor comparison, per-engine AI view | Workflow P0, Dashboards P0/P1 | ⏭ |
| 8 | **Prompt UI** — review suggested prompts, edit, run, see answers with highlighted mentions | Prompt sets P0 | ⏭ |
| 9 | **LLM parsing** — structured-output answer parser and prompt suggester; deterministic version stays as fallback and test oracle | AI answer tracking P0 ("parsed by an LLM") | ⏭ |
| 10 | **Hardening** — DNS-pinned fetches, rate limits on the public audit, cost metering per prompt run | Non-functional | ⏭ Required before public launch |

## Decisions needed (from the PRD's open questions)

- **GEO-first or full suite?** The build so far supports either; the free audit already leads
  with AI readiness. Slices 5–8 are the same either way.
- **Keyword/backlink provider** (DataForSEO vs Semrush vs Ahrefs) blocks rank tracking, keyword
  research and Google AI Overviews tracking. DataForSEO is the cheapest to start with and also
  returns AI Overview SERP features.
- **Default model and run budget for prompt tracking.** Engine calls are the main variable cost
  (PRD). Run a 20-prompt × 3-engine × 2-repeat batch on a real site and record cost per run
  before setting plan limits.
- **Name and domain.** "Rankwell" is still a placeholder in the UI.

## Phase 0 tie-in

The PRD's Phase 0 calls for manual "AI visibility reports" for 10 sites. `seo-audit` plus
`geo-track --out run.json` already produce the raw material for those reports, so validation
interviews can start now, in parallel with slice 5.
