# Portfolio readiness review — 2026-11-15

The application is a substantial local portfolio project. Public demo deployment and presentation still need work. This review changes no application behavior.

**Release update:** the checklist below is the historical review. Its portfolio tasks are now addressed by the read-only hosted preview and release materials. See [release verification](release-verification.md) for current status and the full-stack hosting boundary.

## Finish before sharing a live demo

1. **Create a public demo access flow.** Login.tsx hardcodes the local demo account/password, while main.ts deliberately rejects that password in production. Use a dedicated isolated demo environment with limited visitor permissions; keep production protections. Prevent visitors from locking out other visitors through staff/password/settings actions. Add reset/expiry for visitor data, ideally separate visitor sessions or databases.
2. **Deploy and verify production.** No remote or hosted URL is configured in this checkout. Host the built frontend, Nest API and PostgreSQL with HTTPS and same-origin `/api` routing. The API currently binds loopback; container hosting needs a suitable binding or colocated proxy. Check secure cookies, refresh/deep links, login/logout, persistence and restart behavior at the real URL. Add a health endpoint and basic error monitoring.
3. **Fix the remaining dark-theme contrast issue.** A fresh axe run found one serious violation on `/dashboard`: the period select uses #5f6a6f on #1b333b (2.38:1; target 4.5:1). The checked medicine, POS and general-settings dark pages had no axe violations. Automated checks do not establish full accessibility conformance.
4. **Finish repository release hygiene.** The current branch has no commits and no Git remote. Changes include staged, unstaged and untracked files. Review the final diff, ensure secrets and generated local artifacts stay excluded, create a clean initial commit, and configure the intended repository. Add CI for install, typecheck, build and tests, and document the source template/asset provenance before publishing source. No license/provenance decision was made in this review.

## Make the portfolio presentation convincing

- Add a case study describing the pharmacy workflow, your contribution, redesign decisions, stack, screenshots and an honest account of the reference template and AI assistance where relevant.
- Show three strong journeys: receive purchase → inventory increase; checkout → receipt → stock decrease; low-stock/expiry alert → actionable inventory view. Include mobile and keyboard use.
- Refresh showcase screenshots and record a 60–90 second walkthrough. Existing November 8 dashboard imagery shows charts without their finished drawn state; capture after chart animations finish. Use realistic multi-day fictional sales so the trend tells a story. Seed currently creates sales at execution time; records age out of today's metrics and need a deliberate showcase reset strategy.
- Add live-demo and source links, a preview image, and Open Graph metadata for link sharing. Current index.html has title/description/favicon but no social preview metadata.
- Update docs/progress.md: its final correction entry still says pending, while docs/final-review.md records the scoped PASS for all four corrections. Consolidate current verification in one report.

## Already verified today

- Full workspace TypeScript check and production build pass.
- Formatting check passes (the `lint` script is Prettier, not a semantic lint check).
- `npm audit --omit=dev`: zero known production dependency vulnerabilities.
- Backend test passes 102 integration assertions; frontend unit tests pass 4 cases.
- Playwright browser installation was missing and was restored for this review. The rerun passed all 11 browser tests, covering regressions, navigation, customer editing, POS, purchasing, permissions, responsive layouts, keyboard use and automated accessibility checks.
- Fresh dark-theme axe checks: one dashboard contrast finding; zero violations on the other three checked routes.

## Can wait beyond the portfolio release

External payment charging, email/password reset, accounting integrations, multi-tenancy and clinical certification are not necessary to showcase the documented demo. Describe it as a pharmacy inventory/POS application with recorded payments. The JSONB domain records, full operational snapshots and global write lock are disclosed scale constraints; migrate toward typed relational tables, paged UI queries and server aggregates before claiming large deployment readiness.
