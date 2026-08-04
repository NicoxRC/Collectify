# Phase 14 — Configurable Interest Concepts (Amortizador) (Client)

## Goal

Replace the single "Tasa de interés (%)" input with a repeatable list of named interest/fee concepts at loan creation, and show the resulting breakdown wherever a cuota's total is displayed. Mirrors `docs/phases/PHASE_14_INTEREST_CONCEPTS.md` — **read that document's "Before starting" section first**, since the shape of this UI depends entirely on which of its open questions get resolved (in particular, whether this becomes a real amortization schedule or stays a manual per-concept breakdown).

## Required reading before starting

`docs/phases/PHASE_14_INTEREST_CONCEPTS.md` (the `api` counterpart, including its size-warning and open questions), `docs/GLOSSARY.md`.

## Scope

### Loan creation and refinancing
- [ ] `LoanForm.tsx` / `RefinanceLoanForm.tsx`: replace the single numeric "Tasa de interés (%)" input (today at `LoanForm.tsx` around the interest-rate field) with a repeatable "Conceptos" section — add/remove rows, each with name, type (percentage/fixed), and value — same UX pattern already used for the `installmentAmounts` repeater in the same form.

### Loan and installment detail
- [ ] Wherever a cuota's `totalDue`/`amount` currently renders as a single number (installment table in `LoanDetailPage.tsx`), add a way to see the per-concept breakdown (expandable row or tooltip) — this is the "so a client can be told exactly what they owe and why" requirement.

## Definition of done for this phase

- A loan can be created with multiple named concepts instead of one interest percentage.
- The concept breakdown for any installment is visible to the admin without needing to ask the backend directly.
- All items in `docs/DEFINITION_OF_DONE.md` checklist pass.

## Related documents

- `docs/phases/PHASE_14_INTEREST_CONCEPTS.md` — the `api` counterpart and its open questions
