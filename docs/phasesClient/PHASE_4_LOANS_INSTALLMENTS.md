# Phase 4 — Loans and Installments (Client)

## Goal
The core of the business domain, in the UI: loans (pagarés), their installments (cuotas), and registering payments. Mirrors `docs/phases/PHASE_4_LOANS_INSTALLMENTS.md`. **This phase's UI must trust the API's calculated values — never reimplement the overdue/interest formula on the client.**

## Required reading before starting
`docs/DATABASE.md` (`loans`/`installments`/`payments` tables and the confirmed `installmentAmounts` contract) and `docs/GLOSSARY.md` (Pagaré, Cuota, Mora, Interest rate) are mandatory reading before writing any code in this phase.

## Scope

### Data layer
- [ ] `features/loans/loansApi.ts`, `features/loans/useLoans.ts` — list (filter by client, status), detail, create, update (`interestRate` only, per the API's limited-fields `PATCH`)
- [ ] `features/installments/installmentsApi.ts`, `features/installments/useInstallments.ts` — list within a loan, register-payment mutation

### Pages and components
- [ ] `LoansListPage.tsx` — filter by client and status
- [ ] `LoanDetailPage.tsx` — loan fields plus its installments table, showing the overdue days / interest / total due **exactly as returned by `GET /loans/:id`** — these are calculated fields, not stored, per `docs/DATABASE.md`
- [ ] `LoanForm.tsx` — create a loan: client selector, `promissoryNoteNumber`, `principalAmount`, `interestRate`, `disbursedAt`, `installmentFrequency`, `totalInstallments`, and a per-installment amounts input (installments can be unequal — confirmed in `docs/DATABASE.md`). Validate client-side that the entered amounts sum to `principalAmount` before allowing submit, since the API requires this and rejects otherwise
- [ ] Register-payment flow — a form (modal or inline) on an installment row: `amountPaid`, `paidAt`, `observation`; invalidates the installment/loan queries on success so status updates are reflected immediately
- [ ] Visual indicator for overdue installments (e.g. a badge showing días de mora), driven entirely by the API's computed `overdueDays`/`interest`/`totalDue` fields

## Definition of done for this phase

- A loan can be created through the UI and its generated installments are visible and correct
- A payment can be registered against an installment, and its status (and the parent loan's status, when applicable) updates live after the mutation
- Overdue days and interest shown in the UI match exactly what the API returns — no client-side recalculation

## Do not proceed to Phase 5 or 6 until

The loan-creation form's per-installment amount entry has been tested against the API's `installmentAmounts` validation (must sum to `principalAmount`), and the flow gives a clear error when it doesn't.

## Related documents

- `docs/phases/PHASE_4_LOANS_INSTALLMENTS.md` — the `api` counterpart with the exact interest formula and verified numeric fixtures
