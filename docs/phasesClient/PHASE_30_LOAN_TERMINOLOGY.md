# Phase 30 — Loan Section Terminology and Copy (Client)

## Goal

Apply the confirmed label renames across the loan section, add a "saldo capital a la fecha" card to the loan detail view, and add a short justification note explaining the applied surcharge rate. See `docs/phases/PHASE_30_LOAN_TERMINOLOGY.md` for the backend field this consumes.

## Scope

- [ ] Rename every occurrence in the loan section:
  - "Tasa de interés" (mora rate) → "Incremento consolidado en caso de mora"
  - "Saldo pendiente" → "Saldo pendiente con incremento"
  - "Monto original" → "Monto original sin incremento"
- [ ] Add a "Saldo capital a la fecha" card to the loan detail view, sourced from the new field on `GET /loans/:id` — no client-side recalculation.
- [ ] Add a short justification note near the loan's charge breakdown explaining why the total surcharge rate applies (content per the resolved backend decision on static vs. dynamic wording).

### Tests (per `docs/TESTING.md` conventions for this app)
- [ ] Renamed labels appear correctly everywhere the old ones did — grep the codebase for the old strings to confirm none remain.
- [ ] The new card renders the correct current-balance figure.

## Definition of done for this phase

- The three renames are applied consistently across the loan section, with no old label left behind.
- The "saldo capital a la fecha" card is visible on the loan detail view.
- The justification note is visible and accurate.
- All items in `docs/DEFINITION_OF_DONE.md` checklist pass.

## Related documents

- `docs/phases/PHASE_30_LOAN_TERMINOLOGY.md` — backend field this phase consumes
