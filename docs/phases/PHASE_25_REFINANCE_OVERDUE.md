# Phase 25 — Refinancing With Overdue Installments, UI Fixes and Small Corrections

## Goal

Two bundles requested by the client in the same meeting, merged into one phase:

1. Remove `LoansService.refinance()`'s current block on refinancing a loan with overdue/unpaid installments (`findBlockingInstallmentNumbers`, see `docs/phases/PHASE_17_REFINANCING_RECALC.md`), and correctly fold the interest already accrued on those overdue installments into the new loan's principal — instead of rejecting the refinance outright.
2. A bundle of smaller corrections flagged directly by the client (reunión 2026-08-25), none of which touch a financial calculation — bugs and rough edges, not new business rules. Originally tracked as its own phase (formerly Phase 32 — UI Fixes and Small Corrections); merged into this phase at the human's request. Independent of the refinancing work above and not blocked by its open questions.

## Depends on

`docs/phases/PHASE_23_DYNAMIC_CHARGES.md` — the new principal calculation needs both corriente and moratory interest computed through the unified concept engine, not the old hardcoded mora formula. (The UI-fixes bundle below has no such dependency and can be built independently.)

## Resolved — confirmed directly with the human (reunión 2026-08-25)

Refinancing:
- **The block is removed entirely:** "ya no lo bloqueamos si se refinancia con cuotas vencidas o con fecha de corte ya pasada."
- **New principal formula:** "se deben sumar intereses corrientes y moratorios más el cálculo que ya se hace del capital" — i.e., on top of whatever `LoansService.refinance()`/Phase 17's recalculation already computes for remaining principal, add: (a) the corriente interest already caused on the overdue installments, and (b) the moratory interest/mora already accrued on those same overdue installments, both as of the refinance date.

UI fixes and small corrections:
- **Sequential payment enforcement:** "el botón de pagar está habilitado para todas las cuotas, o sea que podría pagar la cuota novena sin haber pagado las anteriores" — an installment shouldn't be payable while an earlier-numbered installment on the same loan is still pending.
- **"Cotizador" renamed to "Proyector rápido"** — no functional change, name only (see `docs/phases/PHASE_14_INTEREST_CONCEPTS.md`, which shipped it under the old name).
- **Confirmation step before liquidating a credit** — "agregar botón de confirmación al liquidar el crédito" (the existing `POST /loans/:id/payoff` flow, `docs/phases/PHASE_16_EARLY_PAYOFF.md`, currently has none).

## Open questions — confirm before implementing

These apply only to the refinancing half of this phase — the UI-fixes bundle has no open questions and can be built regardless of how these resolve.

- [ ] Phase 17 (`PHASE_17_REFINANCING_RECALC.md`) already computes the new principal as "pending installments minus interest caused to date" (Art. 1653 interest-first allocation, per `docs/GLOSSARY.md` "Imputación del pago"). Confirm this phase's addition is *on top of* that existing Phase 17 formula, not a second, conflicting way of arriving at the new principal — the two need to be reconciled into one formula, not implemented as two competing calculations.
- [ ] Does "fecha de corte ya pasada" (cut-off date already passed) refer to something distinct from an overdue installment, or is it the same condition phrased differently? If it's a separate concept, it isn't yet defined anywhere in `docs/DATABASE.md`/`docs/GLOSSARY.md` — confirm before assuming it's synonymous with "overdue."

## Required reading before starting

`docs/phases/PHASE_6_REFINANCING.md`, `docs/phases/PHASE_17_REFINANCING_RECALC.md` (the recalculation this phase extends), `docs/phases/PHASE_23_DYNAMIC_CHARGES.md`, `docs/GLOSSARY.md` ("Imputación del pago", "Refinanciado"), `docs/phases/PHASE_16_EARLY_PAYOFF.md` and `docs/phases/PHASE_11_AUDIT_LOG.md` (the flows the UI-fixes bundle touches).

## Scope

### Refinancing (once the open questions above are confirmed)

#### Service and API
- [ ] `LoansService.refinance()`: remove the `findBlockingInstallmentNumbers` rejection.
- [ ] New-principal calculation: extend Phase 17's existing recalculation to add accrued corriente interest and accrued mora on any overdue pending installment being rolled into the refinance, reconciled per the open question above.
- [ ] `POST /loans/:id/refinance` response/preview shows the breakdown (remaining capital, interest corrido, mora corrida) that produced the new principal, for transparency — matching this project's existing "never a blank manually-entered figure" precedent from Phase 17.

#### Tests (mandatory)
- [ ] Refinancing a loan with at least one overdue installment succeeds (previously rejected).
- [ ] The new principal correctly includes remaining capital + interest corrido + mora corrida on the overdue installments, verified against a hand-calculated example.
- [ ] Refinancing a loan with no overdue installments is unaffected (same numbers as before this phase).
- [ ] The old blocking behavior is fully gone — no lingering `BadRequestException` for this case.

#### Swagger
- [ ] `POST /loans/:id/refinance` description updated to remove the "must be current" language and describe the new interest-inclusive principal calculation.

### UI fixes and small corrections (not blocked by the open questions above)

#### Backend (defense in depth, not just a UI-disabled button)
- [ ] `InstallmentsService.registerPayment`: reject (400) a payment against installment N if any installment with a lower `installment_number` on the same loan is still `pending` — a real server-side rule, since a disabled button alone doesn't stop a direct API call.
- [ ] Audit log detail: whatever currently renders as an unreadable raw code in a movement's "ver detalle" view — investigate `AuditLog.metadata`'s JSON rendering in that response and confirm the fix is presentation-only (label the known fields clearly) and not a sign `entity_label`/`metadata` themselves are malformed for that action type.
- [ ] Message history: `GET /message-logs` (or wherever the "0 enviados" figure is computed/returned) — remove or correct whatever produced a misleading always-zero "enviados" count; per the client's own framing this list should only be surfacing failures, not a sent-count that's always wrong.

#### Tests (mandatory)
- [ ] Paying installment N is rejected while any earlier installment on the same loan is still pending; succeeds once they're all paid/cancelled.
- [ ] Audit log detail fix covered by a test asserting the specific field that was previously unreadable now renders correctly.

#### Swagger
- [ ] `POST /installments/:id/payments` error response documented for the new sequential-payment rejection.

## Definition of done for this phase

- A loan with overdue installments can be refinanced.
- The new principal is computed exactly per the confirmed formula — not guessed on the open reconciliation question above.
- The sequential-payment rule is enforced server-side, not just hidden in the UI.
- Every UI-fixes item above is fixed with no change to any amount owed, interest calculation, or message content.
- All items in `docs/DEFINITION_OF_DONE.md` checklist pass.

## After this phase

Update `docs/phases/PHASE_17_REFINANCING_RECALC.md` and `docs/DATABASE.md`'s "Refinancing" section to describe the reconciled formula, and remove the now-obsolete "must be current before refinancing" language wherever it appears.

## Related documents

- `docs/phases/PHASE_6_REFINANCING.md`, `docs/phases/PHASE_17_REFINANCING_RECALC.md` — the refinancing flow this phase changes
- `docs/phases/PHASE_23_DYNAMIC_CHARGES.md` — the concept engine this phase's interest calculation depends on
- `docs/phasesClient/PHASE_25_REFINANCE_OVERDUE.md` — the client-side half of this bundle
- `docs/phases/PHASE_16_EARLY_PAYOFF.md`, `docs/phases/PHASE_14_INTEREST_CONCEPTS.md`, `docs/phases/PHASE_11_AUDIT_LOG.md` — the flows the UI-fixes half of this phase touches
- `docs/DATABASE.md`, `docs/GLOSSARY.md`
