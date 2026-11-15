# Frontend review

Review date: 2026-11-08. Scope: redesigned `apps/web/src`, the frontend diff in `.local/frontend-review.diff`, approved design, implementation plan Task 2, documented API contract, and current API validation/service behavior. Static source review only; no test or browser reruns were performed by this reviewer.

## Verdict

**Spec: conditionally meets the intended module coverage; changes requested before completion.** Dashboard, inventory, POS, sales/returns/invoices/quotations, purchasing/receiving, customers, prescriptions, finance, reporting, staff, settings, notifications, and help have implementations and routes. However, the cashier's authorized register workflow is unreachable through navigation, a valid controlled-medicine configuration cannot complete checkout, and report date handling can misstate daily results.

**Quality: changes requested.** Shared Radix dialogs, explicit form labels, focus styles, skip navigation, lazy pages, disabled/loading states, error displays, and empty states provide a useful accessibility and usability foundation. Browser keyboard behavior, responsive layout, visual contrast, printing, and live workflows require the root agent's separate verification. This review does not claim those checks passed.

## Findings

### F1 — P2: Cashiers cannot reach their cash register workflow

Location: `apps/web/src/lib/navigation.ts:11`; allowed navigation filtering in `apps/web/src/components/Layout.tsx:14` and `:19`.

The Finance parent is restricted to admin/pharmacist, so its Cash register child disappears for cashiers from both sidebar and workspace search. No other register link is supplied. The API contract explicitly authorizes cashier-owned register operations, and the register page already supports them when its URL is entered manually. Give cashiers a reachable register navigation item while preserving the finance restrictions.

### F2 — P2: Controlled-only medicines have no prescription selector

Location: `apps/web/src/pages/POS.tsx:15` and prescription-selector condition on `:21`.

`rxNeeded` checks only `requiresPrescription`. A medicine can legally have `isControlled: true` with `requiresPrescription: false` in the create form and API schema. The backend still requires a verified prescription for that medicine (`apps/api/src/pharmacy.service.ts`, checkout). An admin/pharmacist who adds it normally cannot open the prescription selector and receives an unavoidable validation failure at checkout. Treat either flag as requiring prescription selection; consider filtering controlled medicines out of the cashier catalog as well.

### F3 — P2: UTC timestamps are grouped against Dhaka calendar dates

Location: `apps/web/src/pages/Dashboard.tsx:11-12`; `apps/web/src/pages/Reports.tsx:9` and `:16`.

Dashboard and reports extract `createdAt.slice(0,10)`, a UTC date, while the dashboard's `today()` is Asia/Dhaka. A sale at 00:30 Dhaka on November 9 has UTC timestamp November 8 at 18:30: it is missing from November 9 today's sales and grouped under November 8 in charts/date-range reports. Convert timestamps to the configured business timezone before filtering or grouping; preserve date-only accounting fields as calendar dates. The current hardcoded Dhaka helper also ignores changes to the business timezone setting.

### F4 — P2: Editable Business settings have no save action

Location: `apps/web/src/pages/Settings.tsx:12`.

The Business tab renders editable business name and business timezone inputs but suppresses the Save changes footer whenever `tab === 'business'`. Clicking away loses the changes, with no reachable submission control. Provide a save action for this editable tab or present it as read-only information with a link to the saving settings screen.

### F5 — P2: Clearing an existing optional form field is silently ignored

Location: `apps/web/src/components/ResourceForm.tsx:20`.

The payload builder skips every empty string, for creation and PATCH alike. Editing an existing customer's phone/email/address or an existing quotation's notes to an empty value therefore sends no update and retains the previous value after refresh. Optional reference selects also offer a blank choice which cannot remove the previous group/supplier/customer association. Send explicit empty values for clearable text fields on edit and use a defined server-supported clearing representation for optional references.

### F6 — P2: Reports silently present truncated bootstrap data as complete totals

Location: `apps/web/src/pages/Reports.tsx:9-15`; `apps/web/src/lib/store.tsx:6`; cap confirmed in `apps/api/src/pharmacy.service.ts:266`.

All reports and exports aggregate only the bootstrap resource arrays. Bootstrap silently caps each resource to 2,000 newest records, while the UI never calls the available paginated resource endpoint. Once there are more than 2,000 sales, older date-range reports become incomplete/empty and revenue, tax, profit, customer totals, and exports can be misleading. Separate caps can also omit source batches used for report cost calculation. Use authoritative aggregate/report endpoints or retrieve the necessary complete range; until supported, clearly disclose the reporting limitation rather than presenting these values as complete business results.

## Review boundaries

The root agent already owns fixes for prescription payload `customerName`, required medicine unit, cashier customer deletion visibility, and expiry-day stock eligibility. Those known findings are deliberately not duplicated here. The findings above describe the source observed during review; the root agent may resolve them subsequently. Reported line numbers refer to that reviewed source, whose compact JSX frequently places an entire component on one line.

Historical cost is currently derived from source-batch/current medicine prices where sale lines lack captured cost, and the profit report discloses that fallback. Full historical accounting correctness was not established. Monetary CSV exports contain raw integer minor-unit amounts; this follows the internal entity format and should be explained to users if CSV reports are intended for direct spreadsheet accounting.


## Scoped re-review after fixes

All six findings are **ADDRESSED** in the updated source. This is a static re-review; no tests were rerun by this reviewer.

- **F1 ADDRESSED:** `apps/web/src/lib/navigation.ts` now exposes Finance to cashiers with a Cash register parent destination; restricted finance children retain their role filters. Both sidebar and workspace search can reach the authorized register page.
- **F2 ADDRESSED:** `apps/web/src/pages/POS.tsx:79-81` includes `requiresPrescription || isControlled`, so controlled-only medicines expose the existing prescription selector and checkout requirement.
- **F3 ADDRESSED:** `apps/web/src/lib/api.ts:3-10` supplies business-timezone calendar keys; `apps/web/src/lib/store.tsx:12-16` initializes the timezone before rendering the fetched snapshot. Dashboard grouping (`Dashboard.tsx:65,76-77`) and report filtering/chart grouping (`Reports.tsx:45-48,153`) use that key. Explicit date-only accounting values remain calendar dates. The date formatter also preserves date-only values in UTC while displaying timestamps in business time.
- **F4 ADDRESSED:** `apps/web/src/pages/Settings.tsx:324` suppresses the save footer only on the informational Payments tab, leaving a submit button on the editable Business tab.
- **F5 ADDRESSED:** `apps/web/src/components/ResourceForm.tsx:148-165` sends empty text values and explicit null for cleared optional resource references on edit. Strict backend schemas now accept nullable supplier/customer/group references, and backend reference validation skips null values. Password/date omissions retain their separate handling.
- **F6 ADDRESSED:** `apps/api/src/pharmacy.service.ts:260-266` no longer truncates resource arrays to 2,000 records before returning bootstrap. Current frontend reports therefore no longer silently lose older rows due to that cap. This resolves completeness at the cost of an unbounded bootstrap: authoritative paginated/aggregate report endpoints remain a future scalability improvement, not a re-review blocker.

The common form input props now include `aria-label: f.label` (`apps/web/src/components/ResourceForm.tsx:74-78`), giving text/select/textarea controls a stable exact accessible name independent of required markers and hint text. Checkbox controls keep their wrapping text labels.

**Updated scoped verdict: all six requested corrections pass source review. No new important defect attributable to these six fixes was identified.** This does not replace the root agent's ongoing browser, responsive, accessibility, and integration verification. The original findings above remain as review history, superseded by this re-review for current status.
