# PharmaFlow

A redesigned pharmacy management workspace built with React, Vite, TypeScript, NestJS, Prisma and PostgreSQL. The original `pharmalynextjs-10` project is untouched.

## Portfolio release

The public Vercel build is a **read-only fictional preview**, with 30 minute browser sessions, no credentials and no live database. The normal local app below uses the real NestJS API and PostgreSQL and supports all write workflows. See the hosted `/case-study/` for the design story, screenshots and captioned walkthrough.

[Live preview](https://pharmaflow-silk.vercel.app) · [Case study and video](https://pharmaflow-silk.vercel.app/case-study/) · [Source](https://github.com/fakhrul62/pharmaflow)

See [deployment instructions](docs/deployment.md), [source and asset provenance](docs/source-provenance.md), and [release verification](docs/release-verification.md). The Dockerfile serves both applications on one origin; `render.yaml` is an optional deployment blueprint. GitHub Actions checks the full application against PostgreSQL.

## Run locally

Requirements: Node.js 22.12+ (verified here on Node 26), npm, Docker Desktop running with Linux containers.

```sh
npm install
npm run setup
npm run dev
```

Open **http://localhost:5173**. The web server proxies `/api` to NestJS on `127.0.0.1:3001`. Use `localhost` in the browser because it matches the configured trusted origin.

Setup creates `apps/api/.env` if absent, starts PostgreSQL on port **55432**, applies migrations and seeds fictional demo records. The seed skips existing inventory and does not reset your records. Stop the dev servers before regenerating Prisma on Windows to avoid a locked query-engine DLL.

| Local demo account          | Password        | Access                                      |
| --------------------------- | --------------- | ------------------------------------------- |
| admin@pharmaflow.local      | PharmaFlow!2026 | Full workspace                              |
| pharmacist@pharmaflow.local | PharmaFlow!2026 | Pharmacy operations, finance read           |
| cashier@pharmaflow.local    | PharmaFlow!2026 | Checkout, customers, own register and sales |

These are local demonstration credentials. Production refuses to start while active accounts retain the demo password. Change passwords through Settings → Security or administer staff as an admin before deploying.

## Modules

- Overview with actionable sales, stock, expiry, and revenue panels.
- Medicines, categories, brands, units, batches, stock levels, expiry, adjustments, transfers, barcode labels, and movement history.
- POS with barcode keyboard input, verified prescription selection, FEFO allocation, held cart for the current session, discounts, payment recording, and printable receipts.
- Sales, invoices, full returns, and quotations.
- Purchase orders, full receiving, full supplier returns, and suppliers.
- Customers, groups, balances, and transactions.
- Prescriptions, pharmacist verification, quantity-limited dispensing, and history.
- Finance: payment settlements, expenses, other income, and cash register reconciliation.
- Sales, inventory, expiry, customers, tax, and operational profit reports; CSV export and print.
- Team members, predefined role permissions, audit trail, notifications, settings, help, and light/dark appearance.

## Architecture and integrity

`apps/web` is a lazy-routed React app with TanStack Query/Table, React Hook Form, Zod, Radix dialogs, Tailwind CSS, Recharts and Lucide. `apps/api` is NestJS. `packages/shared` supplies TypeScript contracts. Money is integer minor units; API validation rejects invalid quantities and unknown fields.

PostgreSQL contains typed user/session/settings/idempotency tables and validated JSONB domain records. Domain references are enforced by the service. Every write uses a PostgreSQL transaction and shared transaction advisory lock; checkout, receiving, transfers and returns keep stock and financial effects together. Stock operations reject expired/quarantined stock, oversells, duplicate document effects and invalid prescription dispensing. Sessions use opaque hashed tokens, HttpOnly cookies, expiry, Argon2 passwords, server permissions and origin checks.

### Operational limits

This is a local, single-pharmacy application with a real database and API. It is not certified for clinical, regulatory, tax, or controlled-substance compliance. There is no prescribing advice.

Payments are **recorded**, not charged. Process card/mobile/bank transactions separately. Email delivery, public self-registration, email password reset, automatic backups, multi-tenant branches, insurance billing, camera scanning and external accounting are not integrated. Admins create staff accounts; authenticated users change their password. USB keyboard barcode scanners are supported.

Receiving and returns currently process the entire document. Returned sales do not restore prescription dispensing allowance automatically; a pharmacist must review subsequent dispensing. Recorded finance amount/method/date are immutable after posting; use correction entries instead. Customer-group discounts are preferences and must be explicitly applied at checkout.

Resource API lists support database pagination/search. The current UI loads a **complete authorized operational snapshot**; each mutation loads the domain snapshot under a conservative global lock. Reports are complete for that snapshot, with no silent row truncation. Before large-volume production use, replace snapshots with paged frontend queries and server aggregates, and narrow lock scope. Profit reports use captured cost where available and a batch-cost fallback for older data; they are not full bookkeeping statements. CSV monetary columns contain integer minor units.

## Commands

```sh
npm run typecheck
npm run build
npm test
npm run test:e2e
npm audit
npm run docs:generate -w @pharmaflow/api
```

API integration tests require the migrated, seeded PostgreSQL database and create temporary tagged records. Browser tests require `npm run dev` and Playwright Chromium (`npx playwright install chromium`). Tests use fictional local records only. Screenshots and the final verification report are under `docs/`. `docs/openapi.json` can be imported into Swagger Editor or an OpenAPI client; regenerate it after changing validation schemas.

## Production configuration

1. Provision a private PostgreSQL database; set `DATABASE_URL` in the API environment.
2. Set `NODE_ENV=production`, `PORT`, and comma-separated **HTTPS** `APP_ORIGIN` entries; do not expose development database credentials.
3. Deploy migrations with `npm run db:migrate`. Do not run the demonstration seed in production. To create the first admin, set `ADMIN_EMAIL`, `ADMIN_PASSWORD` (12+ characters), and optional `ADMIN_NAME` in the API environment, then run `npm run admin:create -w @pharmaflow/api`. The command refuses to overwrite existing accounts.
4. Build both applications with `npm run build`. Run the API from `apps/api` using `npm start` and serve `apps/web/dist` with SPA fallback. Reverse-proxy same-origin `/api` to the API. The API binds loopback by default.
5. Use HTTPS, replace demo passwords, configure backups and restore checks, and review operational limits above before using real data.

Use the configured business timezone consistently. Currency changes relabel existing amounts rather than converting them; use the correct currency before recording real transactions.

The implementation references current [Vite documentation](https://vite.dev/guide/), [NestJS security documentation](https://docs.nestjs.com/security/authentication), and [Prisma 6 datasource documentation](https://docs.prisma.io/docs/orm/v6/prisma-schema/overview/data-sources). Prisma is pinned to 6.19.3 for its validated client API; the patched `deepmerge-ts` override is locked and verified by generation/tests.
