# Phase 30 — Loan Correction Policy (Client)

## Goal

Expose a "delete loan" action on the loan detail view, available only when the backend allows it (no registered payments), with a clear confirmation step. See `docs/phases/PHASE_30_LOAN_CORRECTION.md` for the backend rule this consumes.

## Scope

- [ ] Loan detail view: show a "Eliminar préstamo" action, disabled (or hidden, with an explanatory tooltip) once the loan has any registered payment — mirror the backend's precondition rather than re-deriving it client-side from raw installment data.
- [ ] Confirmation dialog before deleting, explaining the action is irreversible from the panel (soft-delete, same messaging pattern as any other destructive confirmation in the app).
- [ ] On the backend rejecting a delete attempt (race condition — a payment was registered between page load and the delete click), surface the API's error clearly rather than a generic failure.

### Tests (per `docs/TESTING.md` conventions for this app)
- [ ] The delete action is available for a loan with no payments and unavailable for one with at least one payment.
- [ ] Confirmation dialog blocks accidental deletion.

## Definition of done for this phase

- An admin can delete a mistakenly created loan from the panel, with a clear confirmation step.
- The action is correctly unavailable once the loan has any payment.
- All items in `docs/DEFINITION_OF_DONE.md` checklist pass.

## Related documents

- `docs/phases/PHASE_30_LOAN_CORRECTION.md` — backend rule this phase consumes
