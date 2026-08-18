# Phase 13 — Initial Installment (Cuota Inicial)

## ⚠️ Corrected after client QA (2026-08-18)

The scope below — flagging one of the loan's generated installments as `is_initial` — was **wrong**. Confirmed directly with the human: a "cuota inicial" is not one of the credit's installments at all. It's a down payment the client already made **outside** the credit system, to cover the part of the purchase the loan doesn't finance (e.g. the client pays part of a purchase in cash and the loan only covers the rest). It's purely informational — it has no due date, is never late, never accrues interest, and never affects the amortization schedule or the loan's `principalAmount`.

**Implemented instead**: a nullable `initial_payment` (`DECIMAL(12,2)`) column directly on `Loan`, set once at creation/refinance and displayed on the loan detail screen as an informational line. `Installment.is_initial` was removed entirely (migration `ReplaceIsInitialWithInitialPayment`), along with every exemption/exclusion that depended on it (`enrichInstallment.ts`'s mora exemption, the WhatsApp overdue-reminder and dashboard-KPI query filters). The scope section below is kept for history, per this project's convention of recording what was decided and why rather than silently deleting — do not implement it as written.

## Goal (original — see correction above)

Let one installment in a loan be marked as an "initial payment" ("cuota inicial") — a down payment made at or near disbursement, which is not subject to mora/interest the way a normal missed installment would be, since it isn't really a scheduled repayment the client can be "late" on in the usual sense.

## Scope

### Entities and migrations
- [ ] `Installment`: add `is_initial` (`BOOLEAN`, `NOT NULL DEFAULT false`).
- [ ] Migration `AddIsInitialToInstallments`.

### Loan creation
- [ ] `LoansService.create()`'s installment-generation step: accept which installment index (if any) is the initial one, flagging it `is_initial: true`.
- [ ] `LoansService.refinance()`: same acceptance on the new loan's generated installments.

### Interest/mora calculation
- [ ] `enrichInstallment.ts`: when `is_initial` is true, always return `overdueDays: 0, interest: 0` regardless of `due_date` — mirror the existing early-return already used for non-`Pending` installments exactly. `totalDue` still equals the installment's own `amount` (it's exempt from mora, not free).
- [ ] `overdueReminder.cron.ts` and any dashboard/overdue queries: exclude `is_initial` installments from mora calculations and reminder messages, the same way `cancelled`/`paid` installments are already excluded.

### Tests (mandatory)
- [ ] `enrichInstallment()`: an overdue `is_initial` installment always yields zero mora/interest, regardless of how many days past due.
- [ ] Overdue reminder query excludes `is_initial` installments even when they're technically past their due date.
- [ ] Loan creation correctly flags the chosen installment and leaves all others `is_initial: false`.

### Swagger
- [ ] `is_initial` documented on the relevant DTOs/response schemas.

## Definition of done for this phase

- A loan can be created with one installment marked as the initial payment, and that installment never accrues mora.
- All items in `docs/DEFINITION_OF_DONE.md` checklist pass.

## After this phase

Add an "Initial installment / Cuota inicial" entry to `docs/GLOSSARY.md` and document `is_initial` in `DATABASE.md`'s `installments` table.

## Related documents

- `docs/phases/PHASE_4_LOANS_INSTALLMENTS.md` — installment generation and mora calculation this phase extends
