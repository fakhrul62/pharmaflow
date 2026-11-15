# Final review fixes — 2026-11-08

Addressed all four findings in `docs/final-review.md` in one scoped implementation wave.

- **FR1:** Missing optional dates remain blank; only required dates on create default to the business date. Existing batch identity/quantity controls are disabled and omitted from PATCH, allowing received-batch quarantine/supplier/price maintenance without inventing a manufacturing date.
- **FR2:** Held sales capture independent cart lines, customer, prescription, discount, payment method and entered payment amount. Hold, clear and successful checkout initialize a fresh active draft. Resume restores the complete snapshot and regenerates the checkout request key.
- **FR3:** Profit uses discounted sales revenue excluding collected tax. Sales/chart metrics explicitly retain tax-inclusive gross sales and the tax summary retains tax collected. Captured line cost remains preferred. Expiry report counts batches expiring today as expired, matching sale eligibility.
- **FR4:** Returned/cancelled receipts explicitly show their status, zero outstanding balance, actual refunded amount and cancelled unpaid balance. Returned receipts suppress normal balance demands and change, including in the printable receipt.

`tests/e2e/regressions.spec.ts` covers an actual purchase receipt followed by UI batch quarantine and PATCH payload/persistence assertions; two customer checkouts around a held prescription with distinct discounts/payment state; a taxed discounted sale with captured cost; and reopened fully paid/partly settled return receipts under screen and print media. The latter scenarios intercept API snapshots/checkout to isolate UI behavior without altering shared financial fixtures. The spec authenticates once per run and removes its tagged database fixtures.

Validation:

- `npm run typecheck -w @pharmaflow/web` — passed.
- `npm run build -w @pharmaflow/web` — passed.
- `npm run test -w @pharmaflow/web` — passed: 4 assertions in 1 file.
- `npx prettier --write apps/web/src/components/ResourceForm.tsx apps/web/src/components/Receipt.tsx apps/web/src/pages/POS.tsx apps/web/src/pages/Reports.tsx tests/e2e/regressions.spec.ts` — completed.
- `npx playwright test tests/e2e/regressions.spec.ts` — passed: all 5 targeted browser regressions in 29.6 seconds.
- `npx prettier --check apps/web/src/components/ResourceForm.tsx apps/web/src/components/Receipt.tsx apps/web/src/pages/POS.tsx apps/web/src/pages/Reports.tsx tests/e2e/regressions.spec.ts` — passed.

Earlier browser development runs caught and corrected test selector/path mistakes and a new receipt separator encoding typo. A later clean rerun was interrupted at sign-in by the existing development login rate limiter after cumulative browser tests; no limiter configuration was changed. The final result below uses a fresh development API process and one login per spec. The unchanged full suite and backend suite were not rerun for this fix wave.
