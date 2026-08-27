# Phase 31 — Loan Section Terminology and Copy

## Goal

Fix confusing labels across the loan section that the client reported real users misreading — most importantly, "tasa de interés" being mistaken for a rate charged *separately from* mora-related charges, when it's actually the ceiling that already covers them. Also surface the loan's current principal balance as its own card, and add a short note explaining why a loan's total surcharge rate is what it is.

## Depends on

`docs/phases/PHASE_23_DYNAMIC_CHARGES.md` and `docs/phases/PHASE_24_USURY_MANDATORY.md` — the copy below describes the unified, usury-priced charge model those phases build; do not ship this phase's wording ahead of that model actually existing, or the copy will describe behavior the app doesn't have yet.

## Resolved — confirmed directly with the human (reunión 2026-08-25)

1. **Renames**, applied throughout the loan section:
   - "Tasa de interés" (as currently labeling the mora rate) → **"Incremento consolidado en caso de mora"**
   - "Saldo pendiente" → **"Saldo pendiente con incremento"**
   - "Monto original" → **"Monto original sin incremento"**
2. **Why this matters:** "hay confusión con la tasa de mora que es el techo máximo, creen que es por aparte y no que cobija los cargos que se inventan" — users were reading the mora rate as one charge among several, rather than the ceiling that already encompasses every additional charge on top of it. The rename is meant to make that containment explicit in the label itself.
3. **New card:** "saldo capital a la fecha" on the loan detail view — the current-principal-balance figure that already gets computed when refinancing (per `docs/DATABASE.md`), just not currently shown as its own card outside that flow.
4. **Justification note:** a short explanation on the loan detail view of why the total surcharge rate was applied — "justificación de tasa total de recargos, ponerle donde se explica por qué se pusieron esos intereses."

## Required reading before starting

`docs/phases/PHASE_23_DYNAMIC_CHARGES.md`, `docs/phases/PHASE_24_USURY_MANDATORY.md` (the model this copy describes), `docs/phases/PHASE_17_REFINANCING_RECALC.md` (where the current-balance calculation already exists).

## Scope

### Service and API
- [ ] Expose the current principal balance ("saldo capital a la fecha") on the loan detail response (`GET /loans/:id`) — reuse the same calculation Phase 17's refinance recalculation already performs, rather than writing a second implementation of it.
- [ ] If the justification note needs to reference the loan's specific concepts/values (not just static boilerplate text), expose whatever data the client app needs to render it dynamically — confirm with the human whether a static explanation is sufficient or a per-loan dynamic one is expected before adding new fields for this.

### Tests (mandatory)
- [ ] Current principal balance on `GET /loans/:id` matches the figure Phase 17's refinance calculation would produce for the same loan at the same point in time.

### Swagger
- [ ] Updated field documented on the loan detail response.

## Definition of done for this phase

- The three renamed labels appear consistently everywhere they're currently shown.
- A loan's current principal balance is available on its detail response and shown as its own card.
- All items in `docs/DEFINITION_OF_DONE.md` checklist pass.

## After this phase

Update `docs/GLOSSARY.md`'s "Interest rate / Tasa de mora" entry and `docs/DATABASE.md`'s `loans` table description to use the new terminology consistently, so future phase docs don't reintroduce the old, confusing labels.

## Related documents

- `docs/phases/PHASE_23_DYNAMIC_CHARGES.md`, `docs/phases/PHASE_24_USURY_MANDATORY.md` — the model this phase's copy describes
- `docs/phases/PHASE_17_REFINANCING_RECALC.md` — the existing balance calculation this phase reuses
- `docs/DATABASE.md`, `docs/GLOSSARY.md`
