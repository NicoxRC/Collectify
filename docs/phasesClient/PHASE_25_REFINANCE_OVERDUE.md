# Phase 25 — Refinancing With Overdue Installments, UI Fixes and Small Corrections (Client)

## Goal

Two bundles requested by the client in the same meeting, merged into one phase. See `docs/phases/PHASE_25_REFINANCE_OVERDUE.md` for the backend half of both.

1. Remove the client-side block/error messaging that currently prevents refinancing a loan with overdue installments, and show the new principal's breakdown (capital, interés corrido, mora corrida) so the admin sees how the number was reached.
2. The client-side half of the UI-fixes bundle flagged by the client (reunión 2026-08-25) — originally tracked as its own phase (formerly Phase 32 — UI Fixes and Small Corrections, Client); merged into this phase at the human's request. Independent of the refinancing work above.

## Scope

### Refinancing
- [ ] Remove any client-side guard/warning that disables or blocks the "refinanciar" action when the loan has overdue installments.
- [ ] Refinance form/preview screen displays the new principal's breakdown returned by the API (remaining capital + interés corrido + mora corrida), not just a single opaque total — matching Phase 17's existing "show the computed number, not a blank field" pattern.

### UI fixes and small corrections
- [ ] **Sequential payment buttons:** disable/hide an installment's "pagar" button while any earlier-numbered installment on the same loan is still pending — matches the backend rule, so the UI never even offers an action the API would reject.
- [ ] **Loan detail action buttons:** fix the layout so buttons don't resize or break when there are many of them (flagged as breaking with a realistic number of actions) — wrap or scroll, don't let button count shrink individual button size unpredictably.
- [ ] **Audit log detail:** render the movement detail view's fields legibly instead of showing a raw/unreadable code — consume whatever labeled shape the backend fix (`docs/phases/PHASE_25_REFINANCE_OVERDUE.md`) produces.
- [ ] **Message history:** remove the "0 enviados" counter/label — list should surface failures, not a permanently-inaccurate sent count.
- [ ] **Amortizador panel** — grid/borders and sizing fix belongs to `docs/phasesClient/PHASE_23_DYNAMIC_CHARGES.md`, not duplicated here.
- [ ] **Liquidar crédito:** add a confirmation dialog before calling `POST /loans/:id/payoff` — the action currently has none.
- [ ] **Rename "Cotizador" → "Proyector rápido"** everywhere it appears in the UI (menu, page title, breadcrumbs).

### Tests (per `docs/TESTING.md` conventions for this app)
- [ ] Refinancing a loan with overdue installments succeeds through the UI (previously blocked/hidden).
- [ ] The breakdown renders correctly for a loan with mixed overdue and current installments.
- [ ] Payment buttons correctly disable/enable per installment order.
- [ ] Loan detail buttons remain usable and don't visually break with a realistic number of actions.
- [ ] Liquidar crédito requires confirmation before proceeding.

## Definition of done for this phase

- A loan with overdue installments can be refinanced from the panel with no blocking message.
- The new principal's breakdown is visible before confirming the refinance.
- Every UI-fixes item above is fixed with no visual regression elsewhere in the loan section.
- All items in `docs/DEFINITION_OF_DONE.md` checklist pass.

## Related documents

- `docs/phases/PHASE_25_REFINANCE_OVERDUE.md` — backend half of both bundles this phase consumes
- `docs/phasesClient/PHASE_17_REFINANCING_RECALC.md` — the existing refinance breakdown UI this phase extends
- `docs/phasesClient/PHASE_23_DYNAMIC_CHARGES.md` — amortizador visual fixes, tracked there instead
