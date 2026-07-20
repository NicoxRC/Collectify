# Phase 6 — Refinancing (Client)

## Goal
A UI flow to refinance a loan from its detail page, with the full old-loan/new-loan chain visible. Mirrors `docs/phases/PHASE_6_REFINANCING.md`.

## Before starting this phase
The open question backend Phase 6 had to resolve with the client (what happens to a refinanced loan's remaining unpaid installments) is already confirmed in `docs/DATABASE.md`: they're marked `cancelled` and kept as historical record. This phase just needs to render that state correctly — no new business decision needed here, but read `docs/DATABASE.md` → "Refinancing" before starting.

## Scope

- [ ] `RefinanceLoanForm.tsx` (likely a modal triggered from `LoanDetailPage.tsx`) — new `principalAmount` (manually entered by the admin, not auto-calculated — matches the `api`'s decision that this is a business judgment call, not a formula), new `installmentFrequency`, new `totalInstallments`, per-installment amounts
- [ ] After a successful refinance, `LoanDetailPage.tsx` for the **old** loan shows `status: refinanced` with a link to the new loan
- [ ] `LoanDetailPage.tsx` for the **new** loan shows a link back to the old loan via `refinancedFromLoanId`
- [ ] Installments cancelled as part of the refinance are shown distinctly (e.g. a muted row style with a "cancelled" badge) rather than hidden — `docs/DATABASE.md` is explicit that these are kept as historical record, not deleted

## Definition of done for this phase

- A loan can be refinanced end-to-end through the UI
- Both directions of the refinance chain (old → new and new → old) are visible and correctly linked on their respective detail pages
- Cancelled installments from the old loan remain visible, clearly marked, not hidden

## Related documents

- `docs/phases/PHASE_6_REFINANCING.md` — the `api` counterpart
- `docs/DATABASE.md` — "Refinancing" section, the confirmed behavior this UI must reflect
