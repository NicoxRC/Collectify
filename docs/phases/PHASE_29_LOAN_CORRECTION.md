# Phase 29 — Loan Correction Policy

## Goal

Give an admin a safe way to remove a loan created by mistake, without risking deletion of a loan that already has real financial history against it.

## Resolved — confirmed directly with the human (reunión 2026-08-25)

- **Delete, conditional on no payments:** "eliminar si no tiene pago registrado" — a loan can be deleted only while none of its installments have any registered payment. Once a payment exists anywhere on the loan, deletion is no longer offered; the loan must be handled some other way (e.g. refinanced, or left as historical record) rather than removed.

## Required reading before starting

`docs/DATABASE.md` (`loans`, soft-delete convention), `docs/phases/PHASE_4_LOANS_INSTALLMENTS.md`, `docs/phases/PHASE_11_AUDIT_LOG.md` (deletion must be audit-logged like every other sensitive action).

## Scope

### Service and API
- [ ] `LoansService.remove(id)` (new or extended): reject with a clear error if any installment belonging to the loan has at least one `Payment` row; otherwise soft-delete the loan (and, per this project's cascade conventions, its installments) via the standard `.softDelete()` pattern — no hard delete, matching every other table in `docs/DATABASE.md`.
- [ ] `DELETE /api/v1/loans/:id` — admin only, `@Audit('loan.delete', 'loan')` per the established audit-logging convention.

### Tests (mandatory)
- [ ] A loan with zero payments across all its installments can be deleted.
- [ ] A loan with at least one payment on any installment is rejected with a clear error, unchanged.
- [ ] Deletion is soft (row remains, `deleted_at` set) and produces an audit log entry.

### Swagger
- [ ] `DELETE /api/v1/loans/:id` documented, including the no-payments precondition.

## Definition of done for this phase

- An admin can delete a mistakenly created loan, but only before any payment has been registered against it.
- The action is audit-logged and soft, per this project's existing conventions.
- All items in `docs/DEFINITION_OF_DONE.md` checklist pass.

## After this phase

Update `docs/DATABASE.md`'s `loans` section to note the delete precondition, and `docs/phases/PHASE_11_AUDIT_LOG.md`'s action list to include `loan.delete`.

## Related documents

- `docs/phases/PHASE_4_LOANS_INSTALLMENTS.md`, `docs/phases/PHASE_11_AUDIT_LOG.md`
- `docs/DATABASE.md`
