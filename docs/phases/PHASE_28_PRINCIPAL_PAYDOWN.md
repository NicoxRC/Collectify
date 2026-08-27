# Phase 28 — Principal Paydowns (Abonos al Capital)

## Goal

Let a payment reduce a loan's outstanding principal directly, as a distinct action from an ordinary installment payment (`InstallmentsService.registerPayment`, which is always scoped to one installment's own `amount`).

## Resolved — confirmed directly with the human (reunión 2026-08-25)

- **Not yet built at all:** "abonos al capital falta implementarlo" — this is new scope, not a fix to an existing flow.

## Open questions — confirm before implementing (do not guess any of these)

This phase touches the same territory as `docs/phases/PHASE_16_EARLY_PAYOFF.md`'s interest-first allocation rule (Art. 1653) and Phase 14's fixed amortization schedule ("cuota fija," set once at creation, per `docs/GLOSSARY.md`) — an extra principal paydown interacts with both, and none of the following is addressed by the resolved answer above:

- [ ] **Does a principal paydown re-generate the remaining installment schedule** (fewer installments, or the same number at a lower amount each), **or does it just reduce a tracked "outstanding principal" figure** without touching already-generated `Installment` rows? The former keeps `installments.amount` meaningful for display but requires re-running (or partially re-running) `generateSchedule.ts`; the latter is simpler but means an installment's stored `amount` would silently stop reflecting the client's actual remaining obligation.
- [ ] **Interest-first allocation** — per `docs/GLOSSARY.md` "Imputación del pago," a payment is supposed to settle caused interest before principal. Does an "abono a capital" explicitly bypass that rule by definition (it's principal-only, by the client's own naming), or does it still need to check for unpaid caused interest first?
- [ ] **Effect on `Client.creditUsed`/cupo** (Phase 10) — presumably a principal paydown reduces `outstandingBalance` and therefore frees up cupo; confirm this is intended before assuming it.
- [ ] **Effect on the usury/effective-rate calculation** (Phase 15/23) — a lower principal changes the balance concepts are calculated against; confirm whether a paydown should trigger any recalculation of already-generated concept amounts, or leave them exactly as originally computed (matching the existing "concepts are snapshotted, never recomputed" precedent from Phase 14).
- [ ] Where does the paydown amount get recorded — a new `principal_paydowns` table, or reuse `payments` with a nullable `installment_id` (paydowns aren't tied to one specific cuota)?

## Required reading before starting

`docs/phases/PHASE_14_INTEREST_CONCEPTS.md` (the fixed amortization schedule this interacts with), `docs/phases/PHASE_16_EARLY_PAYOFF.md` (the interest-first allocation rule), `docs/phases/PHASE_10_CLIENT_CAPACITY.md` (cupo calculation), `docs/GLOSSARY.md` ("Imputación del pago", "Cupo").

## Scope

Deliberately left unwritten pending the open questions above — this phase's entities, migrations, and service design depend directly on how those are resolved, and guessing wrong here would misstate a client's real remaining debt. Once confirmed, this section should be filled in following the same structure as every other phase doc in `docs/phases/` (entities/migrations, service/API, tests, Swagger).

## Definition of done for this phase

- Every open question above is confirmed with the human before implementation starts, and the confirmed answers are recorded in this document (matching the "Resolved" pattern used elsewhere, e.g. `docs/phases/PHASE_16_EARLY_PAYOFF.md`).
- A principal paydown can be registered against an active loan and correctly reduces what's owed going forward, per the confirmed design.
- All items in `docs/DEFINITION_OF_DONE.md` checklist pass.

## Related documents

- `docs/phases/PHASE_14_INTEREST_CONCEPTS.md` — the fixed amortization schedule this phase interacts with
- `docs/phases/PHASE_16_EARLY_PAYOFF.md` — the interest-first allocation rule this phase must reconcile with
- `docs/phases/PHASE_10_CLIENT_CAPACITY.md` — cupo calculation potentially affected
- `docs/DATABASE.md`, `docs/GLOSSARY.md`
