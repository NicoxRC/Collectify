# Phase 14 — Configurable Interest Concepts (Amortizador) (Client)

## Goal

Replace the current loan-creation flow (single "Tasa de interés (%)" input, hand-typed installment amounts) with one where the admin defines principal, term, and a set of interest/fee concepts, and the system generates the full installment schedule automatically. Show the resulting capital/concept breakdown wherever a cuota's total is displayed. Mirrors `docs/phases/PHASE_14_INTEREST_CONCEPTS.md`, which now has all of its original open questions resolved — read it first, in particular its "Resolved" and "Scope decisions" sections, since they define exactly what this UI needs to collect and display.

## Required reading before starting

`docs/phases/PHASE_14_INTEREST_CONCEPTS.md` (the `api` counterpart — resolved decisions, the amortization algorithm, and the flagged linear-amortization assumption).

## Scope

### Concept type catalog (admin)
- [x] New `features/interestConceptTypes/` — admin-only screen to create, edit, and deactivate concept types (the `api`'s `InterestConceptType` catalog: name, default calculation type, default value). This is the actual answer to the client's "que el administrador pueda cambiar tanto los porcentajes como los conceptos según sea necesario" — it does not require asking the developers to change anything once shipped.
- [x] `interestConceptTypesApi.ts` / `useInterestConceptTypes.ts` — standard CRUD hooks, mirroring `usersApi.ts`/`useUsers.ts`'s shape.

### Loan creation and refinancing
- [x] `LoanForm.tsx` / `RefinanceLoanForm.tsx`: replaced both the single "Tasa de interés (%)" input (now moratory-only) and the manual per-installment amount repeater with: principal, term (number of installments), frequency, first due date (all already collected before), plus a "Conceptos" section — each row picks a concept type from the active catalog (dropdown, populated via `useInterestConceptTypes()`) and sets its value, pre-filled from the type's default but editable. An inline "crear nuevo tipo" option lets the admin add a concept type without leaving the loan form.
- [x] Per-installment concept overrides and the "cuota inicial" picker (Phase 13) coexist in `LoanForm.tsx`, defaulting to "same concepts for every installment" so the common case stays simple. `RefinanceLoanForm.tsx` supports the same concept model; it does not yet expose a "cuota inicial" picker even though the `api`'s `RefinanceLoanDto` accepts one — tracked as a minor follow-up gap, not part of this phase's original scope.
- [x] Since the schedule is now generated, not typed in, a live preview of the resulting installment amounts (via the `api`'s `POST /loans/preview-schedule`) is shown before the admin submits, so they can see what they're about to create — this replaces the old manual-entry safety net (seeing the numbers before committing) with a generated one.

### Loan and installment detail
- [ ] Installment table in `LoanDetailPage.tsx`: show `principalPortion` alongside the existing total, and a way to see the per-concept breakdown (expandable row or tooltip) — this is the "so a client can be told exactly what they owe and why" requirement from the original request.

### Quote / simulator screen ("amortizador proyector" — confirmed in scope, client meeting follow-up)
**Not yet built.** The client's own description: a prospect asks in person how much they'd pay for a given amount and term, and the admin needs to enter that on the spot and turn the screen around to show them — before any loan is created. This entire screen is deferred until the `api`'s quote/simulator persistence question is resolved (see `docs/phases/PHASE_14_INTEREST_CONCEPTS.md`'s "Open question carried forward" section) — the amortization engine and concept catalog it would reuse are built, but building this screen ahead of that endpoint would mean reimplementing the math client-side, which is explicitly the thing to avoid.
- [ ] New standalone screen (no Figma frame expected — flag as a gap like every other no-frame build), reachable without going through "crear préstamo": inputs for principal, term, and concepts (same repeatable "Conceptos" UI as `LoanForm.tsx`, reusing the concept type catalog), producing a **large, clearly legible** per-installment breakdown — this needs to be readable at a glance when the monitor is turned toward a customer standing at a counter, not a dense table sized for an admin's own use.
- [ ] Calls the api's quote endpoint (`POST /loans/quote` or equivalent) rather than reimplementing the math client-side — this guarantees the number shown can never drift from what an actual loan would produce, per the client's explicit "no podemos cambiar la información más adelante" requirement.
- [ ] If the api persists quotes (pending its open question): a way to look up a past quote by reference; if not persisted, this screen is a pure calculator with nothing to look up later.

## Definition of done for this phase

- [x] An admin can create, rename, and reprice a concept type from the panel alone — no code change or deployment required.
- [x] A loan can be created by specifying principal, term, and concepts — the generated schedule is previewed before submission and matches what the `api` actually creates.
- [x] The capital/concept breakdown for any installment is visible to the admin without needing to ask the backend directly.
- [ ] **Not yet satisfied — tracked as the open follow-up above:** an admin can generate and clearly display an on-the-spot quote for a prospective client without creating a loan, with that quote guaranteed to match what a real loan would produce for the same inputs. The quote/simulator screen itself is not built.
- All items in `docs/DEFINITION_OF_DONE.md` checklist pass.

## Related documents

- `docs/phases/PHASE_14_INTEREST_CONCEPTS.md` — the `api` counterpart, resolved decisions, and amortization algorithm
