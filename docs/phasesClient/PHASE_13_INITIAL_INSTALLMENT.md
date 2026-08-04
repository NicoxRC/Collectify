# Phase 13 — Initial Installment (Cuota Inicial) (Client)

## Goal

Let the admin mark one installment as the initial payment when creating a loan, and make that installment visually distinct (no mora badge) everywhere installment status is shown. Mirrors `docs/phases/PHASE_13_INITIAL_INSTALLMENT.md`.

## Required reading before starting

`docs/phases/PHASE_13_INITIAL_INSTALLMENT.md` (the `api` counterpart).

## Scope

### Loan creation
- [ ] `LoanForm.tsx`: in the installment breakdown repeater, add a way to mark one row as "Cuota inicial" (e.g. a checkbox per row, mutually exclusive across rows).

### Installment display
- [ ] Wherever per-installment status badges render (mora badge, days-overdue badge), an `is_initial` installment shows a distinct badge (e.g. "Sin mora") instead of a mora-days badge, even if its due date has passed.

## Definition of done for this phase

- An admin can flag one installment as the initial payment at loan creation, and it's visually clear everywhere that it doesn't accrue mora.
- All items in `docs/DEFINITION_OF_DONE.md` checklist pass.

## Related documents

- `docs/phases/PHASE_13_INITIAL_INSTALLMENT.md` — the `api` counterpart
