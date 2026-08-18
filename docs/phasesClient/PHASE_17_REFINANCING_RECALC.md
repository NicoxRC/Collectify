# Phase 17 — Refinancing Recalculation (Abono a Capital) (Client)

## Goal

Show the computed new principal (instead of a blank manual-entry field) when refinancing, plus an "abono adicional" input. Mirrors `docs/phases/PHASE_17_REFINANCING_RECALC.md` — **read that document's "Before starting" section first**, since it explicitly reopens a decision from `docs/phasesClient/PHASE_6_REFINANCING.md`, and whether the new principal field stays editable or becomes purely read-only depends on how that's resolved.

## Required reading before starting

`docs/phases/PHASE_17_REFINANCING_RECALC.md` (the `api` counterpart and its open questions), `docs/phasesClient/PHASE_6_REFINANCING.md` (existing manual-entry UI this phase changes).

## Scope

### Refinance form
- [x] `RefinanceLoanForm.tsx`: fetches `GET /loans/:id/refinance-quote` on open and pre-fills the "Monto renegociado" `CurrencyInput` with `suggestedPrincipalAmount` — fully editable afterward (confirmed: pre-filled default, not read-only), plus a new "Abono adicional a capital" input that recomputes the pre-filled figure (pure client-side arithmetic).
- [x] Shows the breakdown (capital pendiente / interés causado / capital sugerido, from the quote's `payoff` object) above the abono field, so the admin sees how the number was derived, not just the final figure.
- [x] Concepts pre-fill from the quote's `concepts` array (the old loan's carried-over baseline), same repeatable "Conceptos" UI, fully editable.

## Definition of done for this phase

- [x] The refinance form shows a computed, explained principal figure instead of an empty manual-entry field.
- [x] All items in `docs/DEFINITION_OF_DONE.md` checklist pass.

## Related documents

- `docs/phases/PHASE_17_REFINANCING_RECALC.md` — the `api` counterpart
- `docs/phasesClient/PHASE_6_REFINANCING.md` — the existing UI this phase changes
