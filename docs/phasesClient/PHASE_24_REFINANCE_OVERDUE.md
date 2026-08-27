# Phase 24 — Refinancing With Overdue Installments (Client)

## Goal

Remove the client-side block/error messaging that currently prevents refinancing a loan with overdue installments, and show the new principal's breakdown (capital, interés corrido, mora corrida) so the admin sees how the number was reached. See `docs/phases/PHASE_24_REFINANCE_OVERDUE.md` for the backend calculation this consumes.

## Scope

- [ ] Remove any client-side guard/warning that disables or blocks the "refinanciar" action when the loan has overdue installments.
- [ ] Refinance form/preview screen displays the new principal's breakdown returned by the API (remaining capital + interés corrido + mora corrida), not just a single opaque total — matching Phase 17's existing "show the computed number, not a blank field" pattern.

### Tests (per `docs/TESTING.md` conventions for this app)
- [ ] Refinancing a loan with overdue installments succeeds through the UI (previously blocked/hidden).
- [ ] The breakdown renders correctly for a loan with mixed overdue and current installments.

## Definition of done for this phase

- A loan with overdue installments can be refinanced from the panel with no blocking message.
- The new principal's breakdown is visible before confirming the refinance.
- All items in `docs/DEFINITION_OF_DONE.md` checklist pass.

## Related documents

- `docs/phases/PHASE_24_REFINANCE_OVERDUE.md` — backend calculation this phase consumes
- `docs/phasesClient/PHASE_17_REFINANCING_RECALC.md` — the existing refinance breakdown UI this phase extends
