# Portfolio release — 2026-11-15

Public preview: https://pharmaflow-silk.vercel.app

Case study and captioned video: https://pharmaflow-silk.vercel.app/case-study/

Source: https://github.com/fakhrul62/pharmaflow

## Completed

- Read-only public preview with fictional data, expiring 30 minute tab sessions, fresh data on reload and a rolling seven-day sales timeline. It never sends requests to a live API. The public preview explicitly describes its boundaries.
- Dashboard dark select contrast corrected. Fresh axe scans of dashboard, medicines, POS and general settings report zero WCAG A/AA violations in the checked pages.
- Case study explains the problem, contribution, workflow reference, design decisions, stack, AI assistance and scale constraints. Updated desktop/mobile/POS screenshots, 83 second captioned MP4 walkthrough, social image and Open Graph/Twitter metadata are included.
- Source provenance documented; unused copied PNG assets excluded. Original commercial template remains outside this repository. No open-source license is implied.
- Docker image serves the full React app and Nest API on one origin, binds the container interface, runs migrations, exposes database readiness and emits correlated 5xx logs. Optional Render blueprint and detailed deployment instructions provided.
- GitHub Actions installs, migrates and seeds a PostgreSQL test database, then runs formatting, typecheck, build, integration/unit and browser checks.
- Historical progress ledger corrected to reflect the passing final review.

## Verification

- Workspace typecheck and production builds passed, including the separate portfolio build.
- Formatting passed; production dependency audit reported zero known vulnerabilities.
- Backend: 102 integration assertions passed. Frontend unit tests: 4 passed.
- Full local browser suite: 11 passed in 3.2 minutes after the release changes. Covers navigation, CRUD, checkout, receiving, permissions, returned receipts, held drafts, taxed profit, responsive layouts, keyboard handling and automated accessibility.
- Preview-specific browser check passed locally: direct routes, visitor entry, rejected writes, session expiry/re-entry, four dark axe scans, zero API requests/browser errors, case study and media availability.
- The same preview-specific browser check passed against the public HTTPS deployment, including all four accessibility scans and media requests.
- Docker image built successfully. A temporary empty PostgreSQL database was migrated by the container; `/api/health` returned 200/ok and a nested SPA route returned 200. This checks actual production-mode startup without local demo credentials.

## Scope

The Vercel preview is intentionally static and read-only. The full writable NestJS/PostgreSQL deployment is packaged and tested locally, but no paid Node/database hosting resources were provisioned. The case study demonstrates real write workflows against the local backend. This release makes no clinical certification, external payment processing or large-scale deployment claim.

The public preview initially exposed a missing build-time preview flag; its explicit build command was corrected before final verification. Browser QA initially exposed a test harness context requirement; the check now creates an explicit browser context. These were corrected and rerun rather than treated as passing checks.
