# SEOBuilder — notes for coding sessions

- Spec: `docs/PRD.md`. Plan and status: `docs/mvp-plan.md` (update the status column when a slice lands). Design decisions: `docs/architecture.md`.
- All logic goes in `packages/core` (framework-free, ESM, `.js` import suffixes). `apps/web` and the CLIs stay thin.
- Types in `packages/core/src/types.ts` mirror the tables in `supabase/migrations`; change both together.
- New audit rule: add it to `RULES` in `audit/checks.ts`, add it to `GEO_READINESS_TYPES` if it measures AI readiness, cover it in `test/site.fixture.ts` + `test/audit.test.ts`, and regenerate the row in `docs/checks.md`.
- Never fetch user-supplied URLs except through `politeFetch` (SSRF guard). Tests that hit the local fixture pass `blockPrivateNetworks: false`.
- Before pushing: `npm run typecheck && npm test && npm run build`.
