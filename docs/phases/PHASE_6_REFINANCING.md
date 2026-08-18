# Phase 6 — Refinancing (Backend)

## ⚠️ Superseded in part by Phase 17

`docs/phases/PHASE_17_REFINANCING_RECALC.md` reopens the manual-entry decision below (line 18's "principal amount ... a business decision, not a formula"): the new loan's `principalAmount` field is now **pre-filled** with a computed default (`GET /loans/:id/refinance-quote`'s `suggestedPrincipalAmount`, reusing Phase 16's `calculatePayoff()`), while remaining a required, fully admin-editable field — so the underlying principle here (a human decides the final number) still holds, only the UI default changed from blank to computed. Everything else in this document (the refinancing flow itself, the `cancelled` installment-status resolution below) is unchanged and still accurate.

## Goal
Support closing out a loan and replacing it with a new one, preserving full history.

## Before starting this phase — stop and confirm with the human

`docs/DATABASE.md` explicitly flags this as an open question: **what happens to a refinanced loan's remaining unpaid installments?** Two plausible approaches:

1. Remaining pending installments are soft-deleted / marked with a distinct status so they're excluded from overdue calculations and reminders, but stay in the database as historical record.
2. Remaining pending installments stay exactly as they are, and the loan's `refinanced` status alone is what excludes it from active overdue processing (the reminder/dashboard queries filter out installments belonging to `refinanced` loans).

**Do not pick one and build it — ask the human which behavior matches how the business actually works before writing this phase's code.** Getting this wrong could either double-charge a client or lose track of real debt.

## Scope (once the above is confirmed)

### Refinancing flow
- [ ] `POST /api/v1/loans/:id/refinance` — admin only. Input: new loan terms (principal amount — typically old balance + accrued interest, but let the admin enter the exact figure rather than auto-calculating it, since the exact renegotiated amount is a business decision, not a formula), new `installment_frequency`, new `total_installments`.
- [ ] Service logic:
  - Sets the old loan's `status` to `refinanced`
  - Creates a new `Loan` with `refinanced_from_loan_id` pointing to the old loan's `id`
  - Generates the new loan's installments (reuse the generation logic from Phase 4)
  - Applies whatever resolution was confirmed above for the old loan's remaining installments

### Endpoints
- [ ] `GET /api/v1/loans/:id` should show `refinanced_from_loan_id` and, if this loan was itself later refinanced, ideally surface the loan it was refinanced *into* as well (a computed reverse lookup, not a stored column — don't add a redundant `refinanced_to_loan_id` column since that's derivable)

### Tests (mandatory)
- [ ] `LoansService.refinance()`: old loan correctly marked `refinanced`, new loan correctly linked and has correct installments generated, whatever behavior was confirmed for remaining old installments is correctly applied
- [ ] Attempting to refinance an already-`paid` or already-`refinanced` loan should be rejected with a clear error

### Swagger
- [ ] Endpoint documented, including a clear explanation of what happens to the old loan in the response/description

## Definition of done for this phase

- A loan can be refinanced end-to-end and the full chain (old loan → new loan) is visible and correct
- The confirmed behavior for the old loan's remaining installments is implemented exactly as agreed with the human — not guessed
- All items in `docs/DEFINITION_OF_DONE.md` checklist pass

## After this phase

Update `docs/DATABASE.md` and `docs/GLOSSARY.md` to remove the "pending confirmation" flags on this topic, replacing them with the confirmed, implemented behavior.
