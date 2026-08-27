# Phase 24 — Refinancing With Overdue Installments

## Goal

Remove `LoansService.refinance()`'s current block on refinancing a loan with overdue/unpaid installments (`findBlockingInstallmentNumbers`, see `docs/phases/PHASE_17_REFINANCING_RECALC.md`), and correctly fold the interest already accrued on those overdue installments into the new loan's principal — instead of rejecting the refinance outright.

## Depends on

`docs/phases/PHASE_22_DYNAMIC_CHARGES.md` — the new principal calculation needs both corriente and moratory interest computed through the unified concept engine, not the old hardcoded mora formula.

## Resolved — confirmed directly with the human (reunión 2026-08-25)

- **The block is removed entirely:** "ya no lo bloqueamos si se refinancia con cuotas vencidas o con fecha de corte ya pasada."
- **New principal formula:** "se deben sumar intereses corrientes y moratorios más el cálculo que ya se hace del capital" — i.e., on top of whatever `LoansService.refinance()`/Phase 17's recalculation already computes for remaining principal, add: (a) the corriente interest already caused on the overdue installments, and (b) the moratory interest/mora already accrued on those same overdue installments, both as of the refinance date.

## Open questions — confirm before implementing

- [ ] Phase 17 (`PHASE_17_REFINANCING_RECALC.md`) already computes the new principal as "pending installments minus interest caused to date" (Art. 1653 interest-first allocation, per `docs/GLOSSARY.md` "Imputación del pago"). Confirm this phase's addition is *on top of* that existing Phase 17 formula, not a second, conflicting way of arriving at the new principal — the two need to be reconciled into one formula, not implemented as two competing calculations.
- [ ] Does "fecha de corte ya pasada" (cut-off date already passed) refer to something distinct from an overdue installment, or is it the same condition phrased differently? If it's a separate concept, it isn't yet defined anywhere in `docs/DATABASE.md`/`docs/GLOSSARY.md` — confirm before assuming it's synonymous with "overdue."

## Required reading before starting

`docs/phases/PHASE_6_REFINANCING.md`, `docs/phases/PHASE_17_REFINANCING_RECALC.md` (the recalculation this phase extends), `docs/phases/PHASE_22_DYNAMIC_CHARGES.md`, `docs/GLOSSARY.md` ("Imputación del pago", "Refinanciado").

## Scope (once the open questions above are confirmed)

### Service and API
- [ ] `LoansService.refinance()`: remove the `findBlockingInstallmentNumbers` rejection.
- [ ] New-principal calculation: extend Phase 17's existing recalculation to add accrued corriente interest and accrued mora on any overdue pending installment being rolled into the refinance, reconciled per the open question above.
- [ ] `POST /loans/:id/refinance` response/preview shows the breakdown (remaining capital, interest corrido, mora corrida) that produced the new principal, for transparency — matching this project's existing "never a blank manually-entered figure" precedent from Phase 17.

### Tests (mandatory)
- [ ] Refinancing a loan with at least one overdue installment succeeds (previously rejected).
- [ ] The new principal correctly includes remaining capital + interest corrido + mora corrida on the overdue installments, verified against a hand-calculated example.
- [ ] Refinancing a loan with no overdue installments is unaffected (same numbers as before this phase).
- [ ] The old blocking behavior is fully gone — no lingering `BadRequestException` for this case.

### Swagger
- [ ] `POST /loans/:id/refinance` description updated to remove the "must be current" language and describe the new interest-inclusive principal calculation.

## Definition of done for this phase

- A loan with overdue installments can be refinanced.
- The new principal is computed exactly per the confirmed formula — not guessed on the open reconciliation question above.
- All items in `docs/DEFINITION_OF_DONE.md` checklist pass.

## After this phase

Update `docs/phases/PHASE_17_REFINANCING_RECALC.md` and `docs/DATABASE.md`'s "Refinancing" section to describe the reconciled formula, and remove the now-obsolete "must be current before refinancing" language wherever it appears.

## Related documents

- `docs/phases/PHASE_6_REFINANCING.md`, `docs/phases/PHASE_17_REFINANCING_RECALC.md` — the refinancing flow this phase changes
- `docs/phases/PHASE_22_DYNAMIC_CHARGES.md` — the concept engine this phase's interest calculation depends on
- `docs/DATABASE.md`, `docs/GLOSSARY.md`
