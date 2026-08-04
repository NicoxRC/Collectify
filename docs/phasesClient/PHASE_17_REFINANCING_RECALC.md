# Phase 17 — Refinancing Recalculation (Abono a Capital) (Client)

## Goal

Show the computed new principal (instead of a blank manual-entry field) when refinancing, plus an "abono adicional" input. Mirrors `docs/phases/PHASE_17_REFINANCING_RECALC.md` — **read that document's "Before starting" section first**, since it explicitly reopens a decision from `docs/phasesClient/PHASE_6_REFINANCING.md`, and whether the new principal field stays editable or becomes purely read-only depends on how that's resolved.

## Required reading before starting

`docs/phases/PHASE_17_REFINANCING_RECALC.md` (the `api` counterpart and its open questions), `docs/phasesClient/PHASE_6_REFINANCING.md` (existing manual-entry UI this phase changes).

## Scope

### Refinance form
- [ ] `RefinanceLoanForm.tsx`: replace the manual principal-amount input with the computed figure returned by the `api` — read-only or editable-with-a-visible-override-warning, per the confirmed answer in the `api` doc — plus a new "Abono adicional a capital" input.
- [ ] Show the breakdown (pending principal, interest causado, resulting new capital) so the admin can see how the number was derived, not just the final figure.

## Definition of done for this phase

- The refinance form shows a computed, explained principal figure instead of an empty manual-entry field.
- All items in `docs/DEFINITION_OF_DONE.md` checklist pass.

## Related documents

- `docs/phases/PHASE_17_REFINANCING_RECALC.md` — the `api` counterpart
- `docs/phasesClient/PHASE_6_REFINANCING.md` — the existing UI this phase changes
