# Phase 23 — Unified Dynamic Charges (Client)

## Goal

Render the loan detail view's charge breakdown as a dynamic per-charge table instead of a vertical list of concepts under each installment amount, let the admin pick a fixed-amount concept's distribution mode, and clean up the amortizador panel's readability. See `docs/phases/PHASE_23_DYNAMIC_CHARGES.md` for the backend model this consumes.

## Scope

### Interest concept type management
- [ ] `InterestConceptTypesPage` (or equivalent): add the `category` selector (`corriente` / `moratorio`) when creating/editing a concept type.
- [ ] When `calculationType` is `fixed_amount`, show the two distribution options (repartir entre todas las cuotas vs. cobrar solo en la primera cuota) and require a choice — no silent default.

### Loan detail — dynamic charge table
- [ ] Replace the current "list of concepts under the installment amount" rendering with a table: one column per charge assigned to the loan (dynamic, driven by whatever the API returns for that loan — not a hardcoded column set), one row per installment.
- [ ] Table must remain usable with a realistic number of concepts (5+) without breaking layout — horizontal scroll inside its own container if needed, not page-level overflow.

### Amortizador panel
- [ ] Add borders/grid lines to the cells.
- [ ] Enlarge the subwindow/panel — current size was flagged as looking bad.
- [ ] Verify against the backend fix for the calculation discrepancy — no client-side recalculation should exist that could drift from the API's numbers; if one does, remove it in favor of trusting the API response.

### Permissions
- [ ] Loan creation form must render and submit successfully for a collector who has the `loans` module grant but not `interest_concept_types` — verify the amortizador/concept breakdown section is what's hidden, not the whole form.

### Tests (per `docs/TESTING.md` conventions for this app)
- [ ] Dynamic charge table renders correctly for loans with varying numbers of concepts (0, 1, many).
- [ ] Fixed-amount distribution selector is required and submits the correct value.
- [ ] Loan creation form is usable (renders, submits) for a collector without the `interest_concept_types` grant.

## Definition of done for this phase

- The loan detail view shows charges as a dynamic per-charge table.
- A fixed-amount concept's distribution mode is selectable and required.
- The amortizador panel is visually fixed (borders, size) and shows figures matching the backend, no independent client-side math.
- A collector without `interest_concept_types` permission can still create a loan through the UI.
- All items in `docs/DEFINITION_OF_DONE.md` checklist pass.

## Related documents

- `docs/phases/PHASE_23_DYNAMIC_CHARGES.md` — backend model and API shape this phase consumes
- `docs/phasesClient/PHASE_14_INTEREST_CONCEPTS.md` — the amortizador/concept UI this phase extends
