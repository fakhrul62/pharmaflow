# Backend implementation and verification

Implemented 2026-11-08 in `apps/api/` and `compose.yaml`.

## Files and architecture

- `apps/api/src/main.ts`: Nest module/controller, authentication guard, same-origin write protection, secure cookie configuration, login/API rate limits, Helmet headers, error envelope, all contract routes.
- `apps/api/src/validation.ts`: strict schemas for writable resources, settings and each transaction operation; integer minor units and quantities, bounded strings, real date validation, resource/permission inventory.
- `apps/api/src/pharmacy.service.ts`: permissions, derived stock/customer balances, PostgreSQL paginated/searchable resource API, safe CRUD/reference checks, staff protections, audit, transaction workflows.
- `apps/api/prisma/schema.prisma`, versioned initial migration: JSONB domain records indexed by resource/time; typed users, sessions, settings and idempotency tables. Passwords use Argon2; session tokens are random, only their SHA-256 digests are stored.
- `apps/api/prisma/seed.ts`: idempotent non-production fictional fixture seed. Three roles, 15 medicines, 17 opening batches (expired/quarantined/near expiry/low stock), 12 sales, three ordered purchases, two prescriptions, finance, suppliers, customers and groups. Dates are relative to seed execution; product artwork references `/img/products/`.
- `apps/api/test/integration.test.ts`: actual HTTP + PostgreSQL integration; fixtures clean up after completion.
- `apps/api/.env.example`: local configuration. Local ignored `.env` has been created.
- `compose.yaml`: PostgreSQL 17, persistent named volume, health check, loopback-only port 55432.

## Operational guarantees

Every domain mutation obtains the same PostgreSQL transaction-scoped advisory lock before reading mutable state. Concurrent API processes therefore serialize inventory, documents, payments and last-admin checks. All effects (stock, movement, sale/purchase, payments, prescription quantities, register and audit) commit together or roll back. This prioritizes simple correctness at the expected small pharmacy operational scale.

Checkout combines duplicate medicine lines, prices on the server, uses FEFO active unexpired batches, rejects oversell/invalid discounts/negative quantities, and enforces valid verified customer-matched prescriptions and pharmacist access for controlled medicines. Cash checkout requires the exact applied amount after change. Credit checkout needs a customer. Receipt/return idempotency is actor-scoped and rejects reuse with a different body. Sales return refunds only actual money collected and cancels the balance; unsafe restocks enter quarantine. Purchase returns support stock transferred across locations and reject insufficient remaining lots. Batch identity/quantity cannot be rewritten through generic PATCH. Linked records cannot be deleted. Payments reconcile outstanding documents; financial payments are immutable. Last active administrator cannot be removed, disabled or demoted.

## Commands verified

From repository root, with PostgreSQL running:

```powershell
npm run db:generate --workspace @pharmaflow/api
npm run db:migrate --workspace @pharmaflow/api
npm run db:seed --workspace @pharmaflow/api
npm run typecheck --workspace @pharmaflow/api
npm run build --workspace @pharmaflow/api
npm test --workspace @pharmaflow/api
```

Migration and seed succeeded. Build/typecheck succeeded. Final integration run passed 54 assertions against PostgreSQL with Zod 4.6.7. Coverage includes concurrent checkout, checkout idempotency and mismatched-key rejection, expired/quarantined exclusion, unsafe return quarantine, prescription limits and controlled items, partial settlement/refund, transfer-aware purchase returns, role guards, last-admin protections, registers, foreign references, and persistence across sessions.

Run API: `npm run dev --workspace @pharmaflow/api`, port 3001. Default trusted browser origins are configured in `.env.example` as `http://localhost:5173,http://localhost:4173`. Browser/API requests use `/api` through the frontend proxy.

Local accounts: `admin@pharmaflow.local`, `pharmacist@pharmaflow.local`, `cashier@pharmaflow.local`, each password `PharmaFlow!2026`. Production seed is disabled; production startup refuses any active account still using that password and requires HTTPS `APP_ORIGIN`. Production cookie is Secure/HttpOnly/SameSite Strict. Password changes revoke sessions. Staff status/role/password changes revoke that user's sessions.

## Practical limits

- JSONB domain relationships are validated by the serialized service rather than SQL foreign keys; restrict direct database write access. Users/sessions do have a database foreign key. Mutation snapshots load operational records, so high-volume installations should introduce typed tables/row locks and archive audit/idempotency history. List pagination and search happen in PostgreSQL; JSON text search is not a full-text search index.
- Bootstrap returns the complete authorized operational snapshot, without silent truncation; resource pagination is available for explicit list navigation. Finance/staff/audit are omitted for unauthorized roles; cashier sales/registers are restricted to their owner.
- Expiry business-day boundaries use the configured, validated IANA settings timezone (default Asia/Dhaka). Stock availability, receiving, prescription validity, return eligibility and generated payment dates use that business date. A date equal to the business date is expired; eligibility requires expiryDate > business date.
- Payment methods record financial events; no external gateway, card processing, supplier remittance, email delivery, real prescriber lookup, or regulatory/tax compliance integration is implied. Purchase payment recording uses bank-transfer when a purchase is initially marked paid because that resource does not include a payment-method field.
- Rate limits are process-local. Use a shared limiter at the production reverse proxy for multiple instances. Expired DB sessions/idempotency/audit retention needs scheduled maintenance at production scale.



## Review correction round 1

Addressed all four findings in `docs/backend-review.md`:

- Every supplied prescription must already be verified, date-valid and customer-matched, including OTC-only checkout. Dispensing state changes only when verified prescription quantities were consumed; pending/rejected records cannot be promoted by checkout.
- Sales/purchase refunds reconcile the immutable related payment ledger and reverse each actual payment method. Mixed card/cash sales produce separate matching refunds. Cash settlements and cash supplier refunds adjust the current refund actor's open register. A ledger/document mismatch rejects the return atomically.
- New cash finance/payment entries store their cashRegisterId when a drawer is open. Posted expense/income amount, method and date are immutable; corrections require explicit new entries. Metadata edits have no drawer effect, including after the original register closes and another drawer opens or another administrator edits.
- Cashier customer deletion is explicitly denied while customer create/update remains available.

Also removed silent bootstrap truncation, added nullable optional resource references for clearing form selections, preserved PATCH keys with Zod4, and made settings timezone authoritative for API business dates. Invalid timezones are rejected. Batch supplier is editable metadata; batch medicine/lot/expiry/location identities remain protected. Formatted all API source, seed and tests with installed Prettier.

Final verification: HTTP/PostgreSQL regression suite passes 95 assertions; API typecheck and production build pass. New assertions reproduce the pending/rejected-RX OTC bypass attempts, mixed-method sale refund, cash-settled supplier refund, drawer A/closed/B finance edits, nullable references, cashier delete denial, deterministic IANA date boundaries, real settings-driven eligibility and stock, and expiry-day receiving rejection. Tests restore modified timezone and clean their private administrator/register/domain fixtures.

Bootstrap and mutation snapshots intentionally load full operational records. This now yields complete demo/report totals instead of misleading truncated totals. Large installations need typed tables, row-level transaction scopes, server aggregate reporting endpoints and archival policies before scaling.
