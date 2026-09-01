# Phase 29 — Principal Paydowns (Abonos al Capital)

## Goal

Let a payment reduce a loan's outstanding principal directly, as a distinct action from an ordinary installment payment (`InstallmentsService.registerPayment`, which is always scoped to one installment's own `amount`).

## Resolved — confirmed directly with the human (reunión 2026-08-25)

- **Not yet built at all (initial framing):** "abonos al capital falta implementarlo" — this was flagged as new scope. See below: turned out to already exist.

## Resolved — confirmed directly with the human (2026-08-30)

- **Effect on `Client.creditUsed`/cupo (Phase 10):** confirmed — a principal paydown reduces `outstandingBalance` and frees up cupo.
- **The mechanism itself:** "el capital abonado primero se va a los intereses que ya corrieron, sean moratorios o corrientes, de ahí ya entra al capital del pagaré como tal... como tal es hacer un refinanciamiento." Confirmed: a principal paydown is not a new business concept — it **is** a refinance, with a lower resulting principal instead of a higher one. This resolves the three open questions below all at once, because they all inherit the answer from how refinancing already works (`docs/phases/PHASE_17_REFINANCING_RECALC.md`):
  - **Schedule regeneration:** yes — a refinance closes the old loan and generates a new one with a fresh schedule, exactly as it already does for any refinance.
  - **Interest-first allocation:** yes, automatically — refinancing already computes `suggestedPrincipalAmount` via `calculatePayoff()`, which applies Art. 1653 interest-first allocation. A paydown doesn't bypass this; it inherits it for free.
  - **Concept/usury recalculation:** the new loan's concepts carry over from the old loan's first installment and are re-validated against the current usury ceiling — same as any other refinance, not a special recalculation step.
- **Where the paydown amount is recorded:** nowhere new. `RefinanceLoanForm.tsx` already has an "Abono adicional a capital" field (built as part of Phase 17) that subtracts the paydown from the suggested principal before submission — purely client-side arithmetic, no new DTO field. `RefinanceLoanDto.principalAmount` is the only value that ever reaches the backend, exactly as it already does for a normal refinance.
- **Audit trail / identifiability (raised 2026-08-31):** considered adding a dedicated "Abono a capital" button on `LoanDetailPage.tsx` that would jump straight into a pre-configured refinance. Rejected — the action bar already has 6 buttons and a 7th was judged too crowded. Instead: `RefinanceLoanForm.tsx`'s existing "Abono adicional a capital" field now has helper text pointing the admin to fill in the free-text "Descripción" field (e.g. "Abono a capital de $100.000") when a refinance is really just a paydown. That description is already persisted on the new `Loan` (shown on `LoanDetailPage.tsx`) and already captured verbatim in the `loan.refinance` audit log entry's metadata (`AuditLogInterceptor` logs the full redacted request body) — so this needed a one-line copy change, not a new field. Anyone looking at the old (refinanced) loan already sees a link to the new one ("Este préstamo fue refinanciado. Ver el préstamo nuevo: ..."), so the description is always one click away.

## Outcome

**No new backend or frontend functionality was built.** The mechanism this phase asked for already existed since Phase 17's "abono adicional a capital" field on the refinance flow. The only change made under this phase is a copy/UX clarification in `RefinanceLoanForm.tsx` so admins know to use the description field to make a paydown-motivated refinance identifiable later.

## Definition of done for this phase

- [x] Every open question above is confirmed with the human before implementation, and the confirmed answers are recorded in this document.
- [x] A principal paydown can be registered against an active loan and correctly reduces what's owed going forward — via the existing refinance flow (Phase 17), no new code needed.
- [x] All items in `docs/DEFINITION_OF_DONE.md` checklist pass — no code changes beyond copy, verified manually.

## Related documents

- `docs/phases/PHASE_17_REFINANCING_RECALC.md` — the phase that already built the "abono adicional a capital" mechanism this phase turned out to just be exposing/clarifying
- `docs/phases/PHASE_14_INTEREST_CONCEPTS.md` — the fixed amortization schedule this interacts with
- `docs/phases/PHASE_16_EARLY_PAYOFF.md` — the interest-first allocation rule, inherited via refinancing
- `docs/phases/PHASE_10_CLIENT_CAPACITY.md` — cupo calculation, confirmed affected as expected
- `docs/DATABASE.md`, `docs/GLOSSARY.md`
