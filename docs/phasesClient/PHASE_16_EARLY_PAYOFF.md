# Phase 16 — Early Payoff and Interest-First Allocation (Liquidación Anticipada) (Client)

## Goal

Give the collector a way to quote and register an early payoff, showing the client exactly how much is owed today and why. Mirrors `docs/phases/PHASE_16_EARLY_PAYOFF.md` — **read that document's "Before starting" section first**, since the shape of the confirmation dialog and submission flow depends on which allocation rules get confirmed there.

## Required reading before starting

`docs/phases/PHASE_16_EARLY_PAYOFF.md` (the `api` counterpart, including its open questions and the Colombian imputación-de-pagos research it's based on).

## Scope

### Loan detail page
- [ ] New "Liquidar anticipadamente" action on `LoanDetailPage.tsx`, near the existing "Registrar pago" entry point.
- [ ] Opens a summary dialog showing the payoff quote and its breakdown (interest applied vs. principal applied, per installment) before the admin confirms — similar shape to `RegisterPaymentDialog.tsx` but read-only summary plus a single confirm action, not a data-entry form.

## Definition of done for this phase

- An admin can quote and confirm an early payoff from a loan's detail page, seeing the interest/principal breakdown before committing.
- All items in `docs/DEFINITION_OF_DONE.md` checklist pass.

## Related documents

- `docs/phases/PHASE_16_EARLY_PAYOFF.md` — the `api` counterpart
