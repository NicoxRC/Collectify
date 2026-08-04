# Phase 17 — Refinancing Recalculation (Abono a Capital)

## Goal

Automatically calculate the new loan's principal when refinancing, instead of requiring the admin to type in an arbitrary figure, and let the admin optionally pay down ("abonar") an extra amount against that new principal at the same time. The new capital is derived from what the client actually owes on the old loan — pending installments, minus interest already caused up to the refinancing date — using the same interest-first allocation this batch of phases introduces in Phase 16.

## ⚠️ This phase reopens a decision Phase 6 already made and documented

`docs/phases/PHASE_6_REFINANCING.md` explicitly states: *"principal amount — typically old balance + accrued interest, but let the admin enter the exact figure rather than auto-calculating it, since the exact renegotiated amount is a business decision, not a formula."* This phase proposes changing that. **Do not treat this as new scope in isolation** — the phase doc, the PR description, and any conversation with the human about this phase must say plainly: "this changes a previously confirmed decision from Phase 6," not present it as if the manual-entry behavior never existed.

## Before starting this phase — stop and confirm with the human

1. Confirm the full formula: new capital = sum of pending installments' principal (per Phase 14's concept breakdown) minus interest causado (via Phase 16's calculation) — does this include the old loan's not-yet-due installments, or only the overdue ones?
2. Does this **replace** Phase 6's manually-entered `principal_amount`, or become a pre-filled, still-overridable default? Given Phase 6's reasoning was explicit ("a business decision, not a formula"), reversing it outright needs explicit sign-off — a pre-filled-but-overridable default is the safer middle ground unless the human says otherwise.
3. The "abono adicional a capital" (extra paydown) — is it registered as a `Payment` (against what, if the new loan/installments don't exist yet at that point in the flow), or does it simply reduce the computed principal before the new loan is generated?
4. Do the old loan's interest concepts (Phase 14) carry over as-is into the new loan, or reset to current defaults/the current usury ceiling (Phase 15)?

**Do not pick answers and build it — ask the human**, same as Phase 6 required for the original refinancing behavior.

## Required reading before starting

`docs/phases/PHASE_6_REFINANCING.md` (the decision this phase reopens), `docs/phases/PHASE_14_INTEREST_CONCEPTS.md`, `docs/phases/PHASE_15_USURY_RATE.md`, `docs/phases/PHASE_16_EARLY_PAYOFF.md` (this phase reuses its calculation module directly).

## Scope (once the above is confirmed)

### Refinancing flow
- [ ] `LoansService.refinance()`: compute the default new `principal_amount` using `calculatePayoff.ts` from Phase 16 (pending installments minus interest causado), rather than duplicating that math. Whether this replaces or merely pre-fills the manual entry depends on the confirmed answer above.
- [ ] Accept an optional `additionalPrincipalPayment` field, applied per the confirmed answer to question 3.
- [ ] New loan's interest concepts default to carrying over from the old loan (per the confirmed answer), remaining editable via Phase 14's `interestConcepts` input, and still validated against Phase 15's usury ceiling.

### Tests (mandatory)
- [ ] `LoansService.refinance()`: computed principal matches `calculatePayoff.ts`'s output for a representative set of pending/overdue installment combinations.
- [ ] `additionalPrincipalPayment` is applied exactly per the confirmed rule.
- [ ] Interest concept carry-over/reset behaves per the confirmed rule, and is validated against the current usury ceiling.

### Swagger
- [ ] Endpoint updated with a clear explanation of how the new principal is derived and that it changes the Phase 6 behavior.

## Definition of done for this phase

- Refinancing a loan produces a computed new principal matching the confirmed formula, with an optional extra paydown applied correctly.
- The confirmed answers to every "Before starting" question are implemented exactly as agreed — not guessed.
- All items in `docs/DEFINITION_OF_DONE.md` checklist pass.

## After this phase

Update `docs/phases/PHASE_6_REFINANCING.md`'s own text (or `docs/DATABASE.md`'s refinancing section) to note it was superseded by this phase, so a future reader doesn't find the two documents contradicting each other silently.

## Related documents

- `docs/phases/PHASE_6_REFINANCING.md` — the decision this phase reopens
- `docs/phases/PHASE_16_EARLY_PAYOFF.md` — the calculation module this phase reuses
- `docs/phases/PHASE_14_INTEREST_CONCEPTS.md`, `docs/phases/PHASE_15_USURY_RATE.md`
