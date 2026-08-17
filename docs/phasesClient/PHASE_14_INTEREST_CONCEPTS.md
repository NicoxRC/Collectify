# Phase 14 — Configurable Interest Concepts (Amortizador) (Client)

## Goal

Replace the single "Tasa de interés (%)" input with a repeatable list of named interest/fee concepts at loan creation, and show the resulting breakdown wherever a cuota's total is displayed. Mirrors `docs/phases/PHASE_14_INTEREST_CONCEPTS.md` — **read that document's "Before starting" section first**, since the shape of this UI depends entirely on which of its open questions get resolved (in particular, whether this becomes a real amortization schedule or stays a manual per-concept breakdown).

## Required reading before starting

`docs/phases/PHASE_14_INTEREST_CONCEPTS.md` (the `api` counterpart, including its size-warning and open questions), `docs/GLOSSARY.md`.

## Scope

### Concept type catalog (admin)
- [ ] New `features/interestConceptTypes/` — a small admin-only screen to create, edit, and deactivate concept types (the `api`'s `InterestConceptType` catalog: name, default calculation type, default value). Confirmed with the human: the admin needs to add new concept types whenever needed, without waiting on a code change — this screen is what makes that possible, so it isn't optional/deferrable scope.
- [ ] `interestConceptTypesApi.ts` / `useInterestConceptTypes.ts` — standard CRUD hooks, mirroring `usersApi.ts`/`useUsers.ts`'s shape.

### Loan creation and refinancing
- [ ] `LoanForm.tsx` / `RefinanceLoanForm.tsx`: replace the single numeric "Tasa de interés (%)" input (today at `LoanForm.tsx` around the interest-rate field) with a repeatable "Conceptos" section — each row picks a concept type from the active catalog (dropdown, populated via `useInterestConceptTypes()`) and sets its value for this loan, pre-filled from the type's default but editable; include an inline "crear nuevo tipo" option so the admin doesn't have to leave the loan form to add a concept type they didn't anticipate needing. Same repeater UX pattern already used for `installmentAmounts` in the same form.

### Loan and installment detail
- [ ] Wherever a cuota's `totalDue`/`amount` currently renders as a single number (installment table in `LoanDetailPage.tsx`), add a way to see the per-concept breakdown (expandable row or tooltip) — this is the "so a client can be told exactly what they owe and why" requirement.

## Definition of done for this phase

- An admin can create a new concept type from the panel, with no code change or deployment required.
- A loan can be created with multiple concepts picked from that catalog instead of one interest percentage.
- The concept breakdown for any installment is visible to the admin without needing to ask the backend directly.
- All items in `docs/DEFINITION_OF_DONE.md` checklist pass.

## Related documents

- `docs/phases/PHASE_14_INTEREST_CONCEPTS.md` — the `api` counterpart and its open questions
