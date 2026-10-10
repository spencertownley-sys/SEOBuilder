# SEOBuilder — notes for coding sessions

- Spec: `docs/PRD.md`. Plan and status: `docs/mvp-plan.md` (update the status column when a slice lands). Design decisions: `docs/architecture.md`.
- Engine logic goes in `packages/core` (pure, no database); anything stateful goes in `packages/platform` (Postgres, auth, jobs). Both are framework-free ESM with `.js` import suffixes. `apps/web` and the CLIs stay thin.
- Schema changes are new files in `db/migrations` (never edit an applied one); they run on server start.
- Every site read or write in `packages/platform` goes through `requireSite(userId, siteId)`.
- New audit rule: add it to `RULES` in `audit/checks.ts`, add it to `GEO_READINESS_TYPES` if it measures AI readiness, cover it in `test/site.fixture.ts` + `test/audit.test.ts`, and regenerate the row in `docs/checks.md`.
- Never fetch user-supplied URLs except through `politeFetch` (SSRF guard). Tests that hit the local fixture pass `blockPrivateNetworks: false`.
- Platform tests need a throwaway Postgres in `TEST_DATABASE_URL` (default `postgres://postgres@127.0.0.1:54329/seobuilder_test`).
- Before pushing: `npm run typecheck && npm test && npm run build`.
