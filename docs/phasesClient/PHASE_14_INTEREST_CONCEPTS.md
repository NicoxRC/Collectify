# Phase 14 — Configurable Interest Concepts (Amortizador) (Client)

## Goal

Replace the single "Tasa de interés (%)" input with a repeatable list of named interest/fee concepts at loan creation, and show the resulting breakdown wherever a cuota's total is displayed. Mirrors `docs/phases/PHASE_14_INTEREST_CONCEPTS.md` — **read that document's "Before starting" section first**, since the shape of this UI depends entirely on which of its open questions get resolved (in particular, whether this becomes a real amortization schedule or stays a manual per-concept breakdown).

## Required reading before starting

`docs/phases/PHASE_14_INTEREST_CONCEPTS.md` (the `api` counterpart, including its size-warning and open questions), `docs/GLOSSARY.md`.

## Scope

### Concept type catalog (pending confirmation of the api doc's open question 6)
- [ ] New admin-only settings screen (no Figma frame expected) to list/create/edit/deactivate `InterestConceptType` rows — name, default calculation type, default value. This is the actual answer to the client's "que el administrador pueda cambiar tanto los porcentajes como los conceptos según sea necesario" — it must not require asking us to change anything once shipped.

### Loan creation and refinancing
- [ ] `LoanForm.tsx` / `RefinanceLoanForm.tsx`: replace the single numeric "Tasa de interés (%)" input (today at `LoanForm.tsx` around the interest-rate field) with a repeatable "Conceptos" section — each row picked from the concept type catalog above (pre-filling name/type/value from the type's defaults), still editable per-row for a one-off override, with add/remove, same UX pattern already used for the `installmentAmounts` repeater in the same form.

### Loan and installment detail
- [ ] Wherever a cuota's `totalDue`/`amount` currently renders as a single number (installment table in `LoanDetailPage.tsx`), add a way to see the per-concept breakdown (expandable row or tooltip) — this is the "so a client can be told exactly what they owe and why" requirement.

### Quote / simulator screen ("amortizador proyector" — confirmed in scope, client meeting follow-up)
The client's own description: a prospect asks in person how much they'd pay for a given amount and term, and the admin needs to enter that on the spot and turn the screen around to show them — before any loan is created.
- [ ] New standalone screen (no Figma frame expected — flag as a gap like every other no-frame build), reachable without going through "crear préstamo": inputs for principal, term, and concepts (same repeatable "Conceptos" UI as `LoanForm.tsx`, reusing the concept type catalog), producing a **large, clearly legible** per-installment breakdown — this needs to be readable at a glance when the monitor is turned toward a customer standing at a counter, not a dense table sized for an admin's own use.
- [ ] Calls the api's quote endpoint (`POST /loans/quote` or equivalent) rather than reimplementing the math client-side — this guarantees the number shown can never drift from what an actual loan would produce, per the client's explicit "no podemos cambiar la información más adelante" requirement.
- [ ] If the api persists quotes (pending its open question 7): a way to look up a past quote by reference; if not persisted, this screen is a pure calculator with nothing to look up later.

## Definition of done for this phase

- An admin can create, rename, and reprice a concept type from the settings screen alone — no code change, no request to the developers, for a new or adjusted concept.
- A loan can be created with multiple named concepts instead of one interest percentage.
- The concept breakdown for any installment is visible to the admin without needing to ask the backend directly.
- An admin can generate and clearly display an on-the-spot quote for a prospective client without creating a loan, and that quote is guaranteed to match what a real loan would produce for the same inputs.
- All items in `docs/DEFINITION_OF_DONE.md` checklist pass.

## Related documents

- `docs/phases/PHASE_14_INTEREST_CONCEPTS.md` — the `api` counterpart and its open questions
