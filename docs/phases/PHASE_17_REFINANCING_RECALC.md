# Phase 17 — Refinancing Recalculation (Abono a Capital)

## Goal

Automatically calculate the new loan's principal when refinancing, instead of requiring the admin to type in an arbitrary figure, and let the admin optionally pay down ("abonar") an extra amount against that new principal at the same time. The new capital is derived from what the client actually owes on the old loan — pending installments, minus interest already caused up to the refinancing date — using the same interest-first allocation this batch of phases introduces in Phase 16.

## ⚠️ This phase reopens a decision Phase 6 already made and documented

`docs/phases/PHASE_6_REFINANCING.md` explicitly states: *"principal amount — typically old balance + accrued interest, but let the admin enter the exact figure rather than auto-calculating it, since the exact renegotiated amount is a business decision, not a formula."* This phase proposes changing that. **Do not treat this as new scope in isolation** — the phase doc, the PR description, and any conversation with the human about this phase must say plainly: "this changes a previously confirmed decision from Phase 6," not present it as if the manual-entry behavior never existed.

## Resolved — confirmed directly with the human

1. **Formula:** new capital = `calculatePayoff()`'s `totalDue` for the old loan's pending installments — the exact same figure `docs/phases/PHASE_16_EARLY_PAYOFF.md`'s payoff quote produces. This includes **all** pending installments, not just overdue ones: not-yet-due installments contribute their principal at face value with zero interest (Phase 16's confirmed rule), and matured ones contribute principal + interest causado. Reusing the payoff quote directly (rather than a separate formula) means refinancing and early payoff can never silently disagree on "what the client currently owes."
2. **Replace vs. pre-fill:** pre-filled, still-overridable default. Phase 6's "a business decision, not a formula" reasoning stands — `RefinanceLoanDto.principalAmount` stays a required field the admin sends, unchanged in shape; only the client-side default shown to the admin changes (from blank to computed).
3. **Abono adicional a capital:** reduces the computed principal **before** the new loan is generated — implemented as pure client-side arithmetic on the pre-filled default (`suggestedPrincipalAmount - additionalPrincipalPayment`), not a new persisted field or a `Payment` row. It has no independent meaning once `principalAmount` is submitted — whatever number ends up in that single field (computed, then possibly hand-edited further) is what's created, exactly as Phase 6 already worked. No backend/DTO change needed for this.
4. **Interest concepts:** carry over as-is from the old loan (its first installment's concepts — the representative baseline, since per-installment overrides are documented elsewhere as an expected-to-be-rare case with no well-defined mapping onto a new loan's possibly-different installment count), fully editable before submit, and — automatically, with no new code — still validated against the current usury ceiling by the same `buildUsuryWarning()` check `persistLoanWithInstallments()` already runs for every loan creation/refinance.

These answers are final for this phase — do not revisit them without a new confirmation round with the human.

**This phase reopens and supersedes the manual-entry decision from `docs/phases/PHASE_6_REFINANCING.md`** — the field is no longer blank by default, but the admin retains full editing control, so Phase 6's underlying principle ("a business decision, not a formula") is preserved even as its concrete UI behavior changes.

## ~~Extended after client QA (2026-08-18) — refinancing now requires the client to be current~~ (SUPERSEDED, Phase 25)

**This entire section was reversed by `docs/phases/PHASE_25_REFINANCE_OVERDUE.md` (confirmed with the human, reunión 2026-08-25) — kept below for historical record only, not current behavior.** The blocking rule described here (including the 8-day extension and `blockedByPendingInstallments`) no longer exists in the code: `LoansService.blockingInstallmentNumbers()`/`findBlockingInstallmentNumbers()` were deleted entirely, and `RefinanceQuote` no longer has a `blockedByPendingInstallments` field. As of Phase 25, an overdue installment no longer blocks refinancing — instead its accrued interest is folded directly into `suggestedPrincipalAmount` (see that phase doc, and the updated "Refinancing" section of `docs/DATABASE.md`).

<details>
<summary>Original text (2026-08-18, superseded)</summary>

**Confirmed directly with the human, reopening point 3 above ("`LoansService.refinance()` itself is unchanged"):** refinancing is no longer unconditional. The client must first be brought current on the old loan (paying overdue installments as ordinary payments, capital + interest) before it can be refinanced — refinancing is not a way to fold overdue debt into a new principal automatically.

- **Blocking rule:** `POST /loans/:id/refinance` rejects (400) if the old loan has any `Pending` installment that is overdue (`dueDate` in the past).
- **The 8-day extension:** once the most overdue installment has reached **8 days** past due, the installment immediately after it also blocks refinancing — even though its own due date hasn't arrived yet. The client can't use a refinance to "skip ahead" past the still-current installment once they're 8+ days behind on the one before it.
- **Advisory surfacing:** `GET /loans/:id/refinance-quote` now also returns `blockedByPendingInstallments: number[]` (the same rule, computed in advance) so `RefinanceLoanForm.tsx` can show the admin why refinancing is blocked, and which installments need to be paid first, before they fill out the rest of the form.
- Implemented as `LoansService.blockingInstallmentNumbers()` (pure, given a loan's pending installments) — used by both `refinance()` (enforced) and `getRefinanceQuote()` (advisory).

This does **not** change how `suggestedPrincipalAmount`/`payoff` are computed above — once the client is current, refinancing proceeds exactly as originally scoped in this phase (pending installments folded into the new principal, not-yet-due ones at face value).

</details>

## Required reading before starting

`docs/phases/PHASE_6_REFINANCING.md` (the decision this phase reopens), `docs/phases/PHASE_14_INTEREST_CONCEPTS.md`, `docs/phases/PHASE_15_USURY_RATE.md`, `docs/phases/PHASE_16_EARLY_PAYOFF.md` (this phase reuses its calculation module directly).

## Scope (once the above is confirmed)

### Refinancing quote (new, read-only)
- [x] `LoansService.getRefinanceQuote(id)` — reuses `calculatePayoff()` from Phase 16 directly (no duplicated math): returns the old loan's payoff breakdown, `suggestedPrincipalAmount` (= its `totalDue`), and the old loan's carried-over concepts (from its first installment, `conceptTypeId`-null ones filtered out since there's no valid catalog id to resubmit).
- [x] `GET /api/v1/loans/:id/refinance-quote` — read-only, same no-`@Roles`-restriction convention as `GET /loans/:id/payoff-quote`.
- [x] `LoansService.refinance()` itself is **unchanged** — per the confirmed answers, `principalAmount` and `concepts` stay exactly the fields they already are; only the client pre-fills them differently now. `additionalPrincipalPayment` is client-side arithmetic, not a new field here.

### Tests (mandatory)
- [x] `getRefinanceQuote()`: `suggestedPrincipalAmount` matches `calculatePayoff()`'s `totalDue` for a representative set of pending/overdue/future installment combinations; concepts are carried over from the first installment; a concept with a deleted (null) `interestConceptTypeId` is excluded from carry-over; empty when the loan has no installments.
- [x] Confirmed via a dedicated regression test in the `refinance` describe block: a refinance's new concepts still get validated against the current usury ceiling via the existing `buildUsuryWarning()` path, no new code needed.

### Swagger
- [x] New endpoint documented, explicitly noting it reopens/changes the Phase 6 manual-entry expectation and that `POST /loans/:id/refinance` itself is otherwise unchanged.

## Definition of done for this phase

- [x] Refinancing a loan produces a computed new principal matching the confirmed formula, with an optional extra paydown applied correctly.
- [x] The confirmed answers to every "Before starting" question are implemented exactly as agreed — not guessed.
- [x] All items in `docs/DEFINITION_OF_DONE.md` checklist pass.

## After this phase

Updated `docs/phases/PHASE_6_REFINANCING.md`'s own text to note it was superseded in part by this phase, so a future reader doesn't find the two documents contradicting each other silently. `docs/DATABASE.md`'s refinancing section did not need updating — no schema or `Payment`/`Installment` relationship changed, only a new read-only aggregation endpoint.

## Related documents

- `docs/phases/PHASE_6_REFINANCING.md` — the decision this phase reopens
- `docs/phases/PHASE_16_EARLY_PAYOFF.md` — the calculation module this phase reuses
- `docs/phases/PHASE_14_INTEREST_CONCEPTS.md`, `docs/phases/PHASE_15_USURY_RATE.md`
