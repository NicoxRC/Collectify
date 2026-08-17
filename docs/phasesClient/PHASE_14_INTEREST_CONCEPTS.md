# Phase 14 — Configurable Interest Concepts (Amortizador) (Client)

## Goal

Replace the current loan-creation flow (single "Tasa de interés (%)" input, hand-typed installment amounts) with one where the admin defines principal, term, and a set of interest/fee concepts, and the system generates the full installment schedule automatically. Show the resulting capital/concept breakdown wherever a cuota's total is displayed. Mirrors `docs/phases/PHASE_14_INTEREST_CONCEPTS.md`, which now has all of its original open questions resolved — read it first, in particular its "Resolved" and "Scope decisions" sections, since they define exactly what this UI needs to collect and display.

## Required reading before starting

`docs/phases/PHASE_14_INTEREST_CONCEPTS.md` (the `api` counterpart — resolved decisions, the amortization algorithm, and the flagged linear-amortization assumption).

## Scope

### Concept type catalog (admin)
- [ ] New `features/interestConceptTypes/` — a small admin-only screen to create, edit, and deactivate concept types (the `api`'s `InterestConceptType` catalog: name, default calculation type, default value). The admin needs to add new concept types whenever needed, without waiting on a code change — this screen is what makes that possible, so it isn't optional/deferrable scope.
- [ ] `interestConceptTypesApi.ts` / `useInterestConceptTypes.ts` — standard CRUD hooks, mirroring `usersApi.ts`/`useUsers.ts`'s shape.

### Loan creation and refinancing
- [ ] `LoanForm.tsx` / `RefinanceLoanForm.tsx`: replace both the single "Tasa de interés (%)" input and the manual per-installment amount repeater with: principal, term (number of installments), frequency, first due date (all already collected today), plus a "Conceptos" section — each row picks a concept type from the active catalog (dropdown, populated via `useInterestConceptTypes()`) and sets its value, pre-filled from the type's default but editable. Include an inline "crear nuevo tipo" option so the admin doesn't have to leave the loan form to add a concept type they didn't anticipate needing.
- [ ] Support per-installment concept overrides for the (expected to be rare) case where a loan's concepts change partway through — e.g. an "advanced" toggle that reveals a per-installment editor, defaulting to "same concepts for every installment" so the common case stays simple.
- [ ] Since the schedule is now generated, not typed in, show a live preview of the resulting installment amounts (via the `api`'s schedule generation) before the admin submits, so they can see what they're about to create — this replaces the old manual-entry safety net (seeing the numbers before committing) with a generated one.

### Loan and installment detail
- [ ] Installment table in `LoanDetailPage.tsx`: show `principalPortion` alongside the existing total, and a way to see the per-concept breakdown (expandable row or tooltip) — this is the "so a client can be told exactly what they owe and why" requirement from the original request.

## Definition of done for this phase

- An admin can create a new concept type from the panel, with no code change or deployment required.
- A loan can be created by specifying principal, term, and concepts — the generated schedule is previewed before submission and matches what the `api` actually creates.
- The capital/concept breakdown for any installment is visible to the admin without needing to ask the backend directly.
- All items in `docs/DEFINITION_OF_DONE.md` checklist pass.

## Related documents

- `docs/phases/PHASE_14_INTEREST_CONCEPTS.md` — the `api` counterpart, resolved decisions, and amortization algorithm
