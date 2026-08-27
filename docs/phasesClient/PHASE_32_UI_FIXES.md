# Phase 32 — UI Fixes and Small Corrections (Client)

## Goal

The client-side half of the bug bundle flagged by the client (reunión 2026-08-25). See `docs/phases/PHASE_32_UI_FIXES.md` for the matching backend fixes (sequential-payment server-side rule, audit log detail, message history count).

## Scope

- [ ] **Sequential payment buttons:** disable/hide an installment's "pagar" button while any earlier-numbered installment on the same loan is still pending — matches the new backend rule, so the UI never even offers an action the API would reject.
- [ ] **Loan detail action buttons:** fix the layout so buttons don't resize or break when there are many of them (flagged as breaking with a realistic number of actions) — wrap or scroll, don't let button count shrink individual button size unpredictably.
- [ ] **Audit log detail:** render the movement detail view's fields legibly instead of showing a raw/unreadable code — consume whatever labeled shape the backend fix (Phase 32, api) produces.
- [ ] **Message history:** remove the "0 enviados" counter/label — list should surface failures, not a permanently-inaccurate sent count.
- [ ] **Amortizador panel** — grid/borders and sizing fix belongs to `docs/phasesClient/PHASE_23_DYNAMIC_CHARGES.md`, not duplicated here.
- [ ] **Liquidar crédito:** add a confirmation dialog before calling `POST /loans/:id/payoff` — the action currently has none.
- [ ] **Rename "Cotizador" → "Proyector rápido"** everywhere it appears in the UI (menu, page title, breadcrumbs).

### Tests (per `docs/TESTING.md` conventions for this app)
- [ ] Payment buttons correctly disable/enable per installment order.
- [ ] Loan detail buttons remain usable and don't visually break with a realistic number of actions.
- [ ] Liquidar crédito requires confirmation before proceeding.

## Definition of done for this phase

- Every item above is fixed with no visual regression elsewhere in the loan section.
- All items in `docs/DEFINITION_OF_DONE.md` checklist pass.

## Related documents

- `docs/phases/PHASE_32_UI_FIXES.md` — matching backend fixes this phase depends on
- `docs/phasesClient/PHASE_23_DYNAMIC_CHARGES.md` — amortizador visual fixes, tracked there instead
