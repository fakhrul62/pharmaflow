# Backend review — 2026-11-08

Scope: Task 1 of `docs/superpowers/plans/2026-11-08-pharmacy.md`, the approved design, API contract, `.local/backend-review.diff`, and current API implementation. Review only; source was not changed. The existing 54 integration assertions were reported passing and were not rerun. Findings below are reproducible API sequences established from source; these additional sequences were not executed against the database.

## Verdicts

- **Spec compliance: changes required.** Most Task 1 workflows and protections are implemented, but a cashier can bypass prescription verification, refund methods do not reconcile settlement history, and customer deletion exceeds cashier permissions.
- **Quality/security: changes required.** Transaction serialization, stock checks, operation idempotency, strict schemas, hashed sessions, and reference validation are sound foundations. The findings below should be fixed before treating the implementation as complete.

## Findings

### [P1] An OTC checkout silently verifies an unrelated prescription

Location: `apps/api/src/pharmacy.service.ts:311-314` (prescription checks only run inside the prescription-required medicine branch at lines 271-279).

Reproduction: create a pending prescription for customer C containing a non-controlled prescription-only medicine R. As cashier, checkout any ordinary OTC product and pass that pending prescription's ID. The checkout never validates its status/customer because the purchased product requires no prescription; the unconditional final RX block changes the pending prescription to `verified`. The cashier can now checkout R for C using that prescription without pharmacist verification. A rejected prescription can likewise become verified. This violates the explicit pharmacist/admin-only verification requirement.

Fix: validate every supplied prescription before any use, and only update dispensing state for an already verified prescription whose lines were actually consumed. Checkout must never promote pending/rejected prescriptions to verified.

### [P2] Returns discard the payment methods used by settlements

Locations: `apps/api/src/pharmacy.service.ts:350-352` and `:369-370`; settlement accepts a separate payment method at `:113-135`.

Reproduction for sales: open an admin register at 1,000 cents; sell a 200-cent item with 100 cents applied by card; settle its remaining 100 cents using a cash payment. Expected register becomes 1,100. Return the sale. The API emits a 200-cent card refund and leaves expected cash at 1,100, despite 100 cents of the collected amount having been cash. The API provides no way to specify a deliberate alternative refund method.

Reproduction for purchases: receive an unpaid purchase, settle it with a cash outgoing payment, and return it. The return records an incoming bank-transfer refund unconditionally and does not restore the cash register. Its hardcoded bank-transfer assumption is only documented for purchases initially created as paid, not later cash settlements.

Fix: derive refundable amounts and methods from the immutable related payment records, or explicitly accept and record a chosen refund method and update the corresponding register consistently. Pass the actor into purchase returns if cash refunds affect the current drawer.

### [P2] Editing historical cash finance records alters the current actor's drawer

Location: `apps/api/src/pharmacy.service.ts:136-139`; current-register lookup at `:321-323`.

Reproduction: open drawer A at 1,000, create a 100-cent cash expense, and close A at 900. Open drawer B at 1,000. PATCH only the old expense's `notes` while changing its `paymentMethod` to card: the old cash amount is reversed into B, making its expected balance 1,100 even though no cash entered B. Similarly, another admin editing an expense reverses the original actor's cash event into the editor's current drawer. Original cash entries do not record a register ID, so this cannot be reconciled reliably from the expense itself.

Fix: associate cash events with their register and prevent editing posted cash effects across closed registers; use explicit correction entries when a historical transaction needs changing. Metadata-only edits should have no drawer effects.

### [P2] Cashiers can delete customers although their permission is create/update only

Locations: `apps/api/src/pharmacy.service.ts:52-53` and `:147`.

Reproduction: authenticate as cashier, create an unlinked customer, then DELETE `/api/resources/customers/{id}`. DELETE shares the same `assertWrite` gate as create/update and succeeds. The contract grants cashiers customer create/update, not deletion, so the server currently grants a broader action than specified.

Fix: make authorization action-aware and deny cashier customer deletion. Keep the existing reference protection for roles that may delete.

## Areas checked without additional findings

- Every domain mutation takes the same PostgreSQL advisory lock inside its transaction before loading records; concurrent checkout and repeated operations are protected across API instances. Actor-scoped idempotency additionally rejects mismatched requests.
- Quantities and real calendar dates are validated. FEFO only uses active batches strictly after the Dhaka business date; receiving uses the same expiry boundary. Quarantined/expired returns are segregated.
- Required prescription quantities combine duplicate checkout medicine lines, enforce remaining quantities, and commit with inventory. The verification bypass above is a separate path around that otherwise correct enforcement.
- Purchase receipt/return status checks prevent a second stock effect; returns account for locations sharing the lot and reject insufficient total stock.
- Generic records validate declared references, batch identity is immutable, and deletion checks nested item references. Typed session/user relations have a database FK. JSON domain references remain service-enforced as disclosed in the backend report.
- Staff hashes are not exposed, staff session invalidation and last-admin guards are present, and writes require a configured Origin with JSON content. Finance/staff/audit reads and cashier-owned sales/register restrictions are enforced.

## Remaining structural limitations

`packages/shared` does not exist despite the design/Task 1 naming it, and the API contract's `Entity` uses `any`; a shared typed contract is therefore incomplete. This is lower urgency than the behavioral findings. Bootstrap also loads complete authorized lists before slicing them to 2,000, and every mutation loads the entire JSON store; the backend report already discloses the operational-scale limit. Dependency vulnerability remediation is being reviewed separately and is intentionally omitted here.

## Scoped re-review — correction round 1

Reviewed the corrected current service and validation source, the added regression assertion source, and the implementation evidence in `docs/backend-report.md`. No tests were rerun and no implementation files were changed. This outcome supersedes the original blocking verdict for the four findings; it is a scoped review of these fixes, not a new full-system audit.

| Original finding | Outcome | Current implementation evidence |
| --- | --- | --- |
| P1 OTC prescription verification bypass | **ADDRESSED** | `apps/api/src/pharmacy.service.ts:750-762` validates every supplied RX as already verified, date-valid and customer-matched before checkout. Lines 864-868 only update dispensing state when prescribed quantities were consumed. Pending/rejected records cannot be promoted by an OTC-only checkout. |
| P2 Refund methods lose settlement history | **ADDRESSED** | Sales and purchases call the shared refund routine at lines 1037 and 1132. Lines 1056-1091 require the payment ledger to reconcile and reverse each original method separately. The actor is passed to payment creation, and lines 882-923 apply cash refunds to the refund actor's open register and retain its ID. All remains in the serialized transaction, so reconciliation failures roll back stock and document changes. |
| P2 Historical finance edits change current drawer | **ADDRESSED** | Lines 367-377 reject changes to posted amount/method/date. Lines 446-460 apply cash effects only on creation and retain cashRegisterId. Allowed metadata edits have no register effects, including edits by another administrator or after closing the original drawer. |
| P2 Cashier customer deletion exceeds role | **ADDRESSED** | Lines 501-506 reject cashier deletion before the shared write gate; customer create/update authorization remains available. |

**Scoped compliance verdict: PASS. Scoped quality/security verdict: PASS.** No new important defect was identified in these corrections. The report records 95 passing HTTP/PostgreSQL assertions plus successful API typecheck/build. I inspected the new regression source for pending/rejected OTC bypass attempts, mixed card/cash refunds, cash purchase refunds, closed/current drawer edits and cashier deletion; these match the original reproduction cases.

The additional changes are consistent in the inspected paths: a mutation snapshot derives one business date from the configured validated timezone; stock listing, checkout, RX verification, receiving, returns and generated payment dates use it. Nullable optional supplier/group/customer references still validate non-null targets. Bootstrap now returns complete authorized lists instead of silently slicing at 2,000. Complete snapshots retain the disclosed operational-scale memory/query limitation. The earlier missing shared typed-contract observation is outside these four fixes and is not reclassified as completed by this scoped review.
