# Final application review — 2026-11-08

## Verdict

**Changes requested: four P2 correctness issues below. No new P1 was identified.** The implementation covers the approved modules and has substantive server validation, role enforcement, serialized stock/money transactions, persistent storage, and browser workflows. This review inspected the current owning sources, design, README, progress/backend reports, and preceding review reports. Previously corrected findings and explicitly disclosed deployment/accounting/scale limitations are not repeated.

This was a source review. The root reports 102 passing backend assertions and three passing critical browser journeys; the broader browser suite was still running. Tests and browser reproductions were not rerun here. The sequences below follow directly from the inspected code.

## Findings

### FR1 — P2: Editing a received batch silently supplies an immutable manufacturing date

Locations: `apps/web/src/components/ResourceForm.tsx:25-32`, `:149-161`; API guard `apps/api/src/pharmacy.service.ts:354-366`, receipt-created batch `:951-962`.

Receive a purchase into a new batch, then open that batch's edit form and change only its status to quarantined (or its supplier). Receiving creates the batch without `manufacturingDate`. The form initializes every absent date field to today, including this optional field, and submits it in PATCH. The API therefore rejects the entire edit as an attempted change to immutable batch identity. This prevents normal quarantine/metadata maintenance on every newly received batch unless the user discovers and manually clears the unexpected date first.

Fix: preserve missing optional dates as empty when editing and omit immutable batch identity fields from PATCH (or submit only genuinely editable/changed fields). Verify status/supplier updates on a batch created through receiving, not only on seeded batches that already have manufacturing dates.

### FR2 — P2: A held sale resumes with another customer's transaction context

Locations: `apps/web/src/pages/POS.tsx:458-475`, successful checkout reset `:515-520`.

Select customer A, add items and a discount, and hold the sale. Process a second sale for customer B, then resume the held sale. Only the item array was stored; customer B remains selected, the discount has been reset to zero, and any held prescription selection was cleared. An OTC held sale can consequently complete against B with the wrong price, while a prescription sale loses its prescription context. The held-sale action also leaves A's customer/discount/RX values active when starting the intervening sale.

Fix: hold and restore the complete sale draft (items, customer, prescription, discount and relevant payment state), initialize a fresh draft after holding/completing a sale, and regenerate the request key when restoring it. Verify two different customers with different discounts and a held prescription.

### FR3 — P2: Profit includes collected sales tax as earnings

Locations: `apps/web/src/pages/Reports.tsx:52`, `:125-135`, net-profit card `:342-349`; tax-inclusive sale total is produced at `apps/api/src/pharmacy.service.ts:829-830`.

Set tax to 10%, then sell an item with a 100.00 pre-tax price and captured cost of 60.00, without discount or other income/expenses. The sale's total is 110.00. Reports use that tax-inclusive total as revenue and show gross/net profit of 50.00 instead of 40.00. This affects both the profit report and net-profit summary cards whenever sales tax is configured. The disclosed lack of full bookkeeping does not explain counting separately recorded collected tax as operating profit.

Fix: calculate profit revenue from `subtotal - discount` (or `total - tax`), retaining a separately named tax-inclusive sales/collections metric where desired. Verify a taxed and discounted sale with captured cost.

### FR4 — P2: Returned receipts falsely show the cancelled sale as money owed

Locations: `apps/web/src/components/Receipt.tsx:78-82`; return state `apps/api/src/pharmacy.service.ts:1031-1037`.

Complete a fully paid sale, return it, then reopen its receipt from Sales or Invoices. The return correctly sets `status: returned`, retains `refundedAmount`, and sets `amountPaid` to zero. Receipt ignores that status and unconditionally renders `total - amountPaid` as “Balance due,” so a fully refunded sale claims the customer owes the full original total. It also retains the “Sale completed” success heading.

Fix: render returned/refunded state explicitly, show the actual refund and cancelled balance where useful, and suppress outstanding-balance demands for returned documents. Verify reopened/printed receipts for both a fully paid return and a partially settled credit return.

## Review boundary

No implementation changes were made. Only this report was added. A scoped re-review should inspect the fixes and their focused evidence; the existing backend/frontend reports retain their earlier review scope and historical findings.

## Scoped final re-review — correction round 1

**Final scoped verdict: PASS. FR1–FR4 are ADDRESSED.** This supersedes the original changes-requested verdict for the four findings. Inspected the current ResourceForm, Receipt, POS and Reports implementations, the focused regression source, and `docs/final-fixes-report.md`. No important fix-induced issue was identified. No tests were rerun and no implementation was edited by this reviewer.

| Finding | Outcome | Evidence |
| --- | --- | --- |
| FR1 received-batch metadata edit | **ADDRESSED** | `ResourceForm.tsx:25-36` leaves absent optional dates blank. Lines 70-79 identify immutable batch fields; disabled controls and the payload exclusion at line 162 prevent identity/quantity changes in PATCH. The regression at `tests/e2e/regressions.spec.ts:68` receives a real purchase, verifies the missing date, quarantines through the UI, checks the outgoing payload, and rereads persisted status. |
| FR2 held-sale context | **ADDRESSED** | `POS.tsx:32-39` defines a complete draft, lines 96-104 restore/reset all contextual values and regenerate the request key, and lines 478-498 copy and restore the held draft. Clear, hold and successful checkout initialize a fresh draft. The regression at `tests/e2e/regressions.spec.ts:129` checks two customers, distinct discounts, held prescription, selected payment method/entered amount, and separate checkout keys. |
| FR3 sales tax counted as profit | **ADDRESSED** | `Reports.tsx:52-53` separates tax-inclusive gross sales from tax-exclusive revenue. Profit rows and cards use the latter; gross-sales and tax metrics remain separately labelled. The regression at `tests/e2e/regressions.spec.ts:250` verifies 100.00 subtotal less 10.00 discount, 9.00 tax, and 60.00 captured cost produce 90.00 revenue, 30.00 profit, 99.00 gross sales and 9.00 tax. |
| FR4 returned receipt balance | **ADDRESSED** | `Receipt.tsx:7-8` recognizes returned/cancelled state, lines 35-40 show zero due in printable content, lines 89-105 show refund/cancelled balance, and lines 107-119 suppress normal change/balance demands. The two return regressions cover full and partial original payment and assert the printable state. |

Verification evidence records all five focused browser regressions passing, plus web typecheck/build and four unit assertions. FR1 exercises the real API/database; FR2–FR4 intentionally intercept snapshots/checkout to test UI state and rendering, with backend financial correctness covered by the separately reported integration suite. Print assertions inspect print-media content rather than a physical printer. The full application/backend suites were not rerun for this scoped correction wave.

The adjacent ProductImage extraction, immutable-record edit visibility, and modal autofocus changes were also inspected for immediate regressions. They preserve the relevant component contracts and server restrictions; no additional important finding arose in this scoped review.
