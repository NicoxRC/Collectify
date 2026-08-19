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
- [x] Installment table in `LoanDetailPage.tsx`: shows `principalPortion` alongside the existing total, and the per-concept breakdown — this is the "so a client can be told exactly what they owe and why" requirement from the original request.

### Quote / simulator screen ("amortizador proyector" — confirmed in scope, client meeting follow-up) — built 2026-08-18
The client's own description: a prospect asks in person how much they'd pay for a given amount and term, and whoever is helping them needs to enter that on the spot and turn the screen around to show them — before any loan is created. Confirmed with the human: a quote is never persisted (see `docs/phases/PHASE_14_INTEREST_CONCEPTS.md`'s resolved open question), and this tool is open to **every authenticated user, not just admins** — it touches no client data and persists nothing, so it carries none of the risk "Crear préstamo" does, and the person actually facing a walk-in prospect is just as likely to be a collector.
- [x] New standalone screen, `LoanQuotePage.tsx` at `/cotizador` (no Figma frame, flagged as a gap like every other no-frame build): inputs for principal, term, frequency, and concepts (same repeatable "Conceptos" UI as `LoanForm.tsx`, reusing the concept type catalog), producing a **large, clearly legible** headline "cuota mensual/quincenal" figure plus a detail table below it — sized to be read at a glance when the monitor is turned toward a customer standing at a counter, not a dense table sized for an admin's own use.
- [x] Calls the existing `POST /loans/preview-schedule` — not a new `POST /loans/quote` endpoint, since that would mean two implementations of the same math where one is expected to always match the other. Reusing the one that already exists (and that `LoanForm.tsx` already calls for its own pre-submit preview) is what actually guarantees the number can never drift, per the client's explicit "no podemos cambiar la información más adelante" requirement.
- [x] ~~If the api persists quotes...~~ → resolved to "pure calculator" — nothing to look up later, by design.

## Definition of done for this phase

- [x] An admin can create, rename, and reprice a concept type from the panel alone — no code change or deployment required.
- [x] A loan can be created by specifying principal, term, and concepts — the generated schedule is previewed before submission and matches what the `api` actually creates.
- [x] The capital/concept breakdown for any installment is visible to the admin without needing to ask the backend directly.
- [x] An admin or collector can generate and clearly display an on-the-spot quote for a prospective client without creating a loan, with that quote guaranteed to match what a real loan would produce for the same inputs — the "Cotizador" screen at `/cotizador`.
- All items in `docs/DEFINITION_OF_DONE.md` checklist pass.

## Related documents

- `docs/phases/PHASE_14_INTEREST_CONCEPTS.md` — the `api` counterpart, resolved decisions, and amortization algorithm
