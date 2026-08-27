# Phase 22 — Unified Dynamic Charges (Cargos Corrientes y Moratorios)

## Goal

Stop treating moratory interest as a single hardcoded rate/formula (`loans.interest_rate`, the `installmentCalculations.ts` overdue formula) and price it through the same admin-managed concept engine Phase 14 already built for ordinary ("corriente") interest — so the admin can add, remove, or reprice moratory charges the same way they already do for corriente ones, without a code change. Also fixes how a fixed-amount concept distributes across a loan's installments, and how the loan detail view displays the resulting charges.

## Resolved — confirmed directly with the human (reunión 2026-08-25)

1. **Moratory interest becomes dynamic:** "los intereses moratorios se agreguen exactamente igual a como se agregan los intereses corrientes... que sean dinámicos." Moratory charges are no longer a single fixed rate applied by a hardcoded formula — they're one or more `InterestConceptType` rows the admin manages, the same catalog used for corriente concepts, distinguished by a new category so the app knows which concepts apply on-time vs. only once an installment is overdue.
2. **Fixed-amount distribution mode:** when a concept's `calculation_type` is `fixed_amount`, the admin must choose between two modes — **split the total evenly across every installment**, or **charge the full amount only on the first installment**. This replaces the original, vaguer "repartir vs. copiar a cada mes" framing from the initial meeting notes — the human's final answer above is authoritative.
3. **Loan detail charge table:** "la tabla en el valor de la cuota no debe mostrarse cada concepto debajo del valor sino en una tabla dinámica en la que el header tendría el cargo asignado y el valor a la cuota." One column per charge actually assigned to the loan (dynamic, not a fixed set of named columns like the original "Cuota sin incremento / Tasa de interés / Gastos de cobranza / Gestión por mora / Firma electrónica / Cuota a pagar" sketch from the meeting notes) — that fixed-column sketch is superseded by this dynamic-table answer.
4. **Amortizador fixes:** add borders/grid lines to the cells, make the panel bigger (currently reported as looking bad/cramped), and investigate why its calculation comes out slightly different from the figure Juan uses manually — resolve the discrepancy, don't just document it.
5. **Permission gap:** a collector must be able to create a loan even where module permissions hide the amortizador's detail from them — "los cobradores no miren el amortizador pero pues sí deben poder crear el crédito." `ModulePermissionsGuard`'s current `loans` module grant is apparently gating the amortizador view in a way that also blocks loan creation for a collector without the `interest_concept_types` grant; these need to be decoupled.

## Open questions — confirm before implementing

- [ ] **Which existing `interest_concept_types` rows are "moratorio" vs. "corriente"?** A new column (e.g. `category` ENUM `corriente` / `moratorio`) is needed to distinguish them — confirm the exact set of moratory concepts the client wants pre-seeded (today there's exactly one implicit moratory rate, `loans.interest_rate`; migrating it forward as the first seeded moratory concept type needs the client's sign-off on wording, not just a mechanical port).
- [ ] **When does a moratory concept's `computed_amount` get calculated** — at loan creation like a corriente concept (which would require projecting future overdue days, impossible to know in advance), or only once an installment actually goes overdue (computed on read, like today's mora formula)? The safest reading of "se agreguen exactamente igual a como se agregan los intereses corrientes" is that the *catalog mechanism* is shared, not that the *timing* is identical — corriente concepts are priced once at generation time against a known declining balance, while moratory charges can only be priced once overdue days are known. Confirm this distinction explicitly with the client before implementing, since guessing wrong here changes what a client is actually charged.
- [ ] Exact wording/value for the pre-seeded moratory concept(s) that replace `loans.interest_rate`'s role.

## Required reading before starting

`docs/phases/PHASE_14_INTEREST_CONCEPTS.md` (the engine this phase extends), `docs/phases/PHASE_15_USURY_RATE.md` (Phase 23 will build directly on this phase's category split), `docs/DATABASE.md` (`interest_concept_types`, `loan_installment_concepts`, `installments` overdue formula), `apps/api/src/loans/amortization/generateSchedule.ts`.

## Scope (once the open questions above are confirmed)

### Entities and migrations
- [ ] `InterestConceptType.category` (ENUM: `corriente`, `moratorio`) — which side of the engine a concept type belongs to.
- [ ] `InterestConceptType.fixedAmountDistribution` (ENUM: `split_across_installments`, `first_installment_only`), nullable — only meaningful when `calculationType` is `fixed_amount`.
- [ ] `LoanInstallmentConcept.category` snapshot, mirroring the type's category at generation time (same snapshot precedent as `name_snapshot`/`calculation_type`).
- [ ] Migration to add the above columns; a follow-up data migration seeding the current `loans.interest_rate` value forward as the initial moratory concept type, per the resolved wording from the open question above.
- [ ] `loans.interest_rate` is deprecated once moratory concepts fully replace its role — do not drop the column in this phase (existing loans still reference it); mark it superseded in `docs/DATABASE.md` instead.

### Service and API
- [ ] `generateSchedule.ts`: honor `fixedAmountDistribution` when generating `computed_amount` for a fixed-amount corriente concept.
- [ ] New logic (location depends on the open "timing" question above) to compute moratory concept amounts per overdue installment, replacing the hardcoded formula in the overdue-calculation path — reusing `loan_installment_concepts` semantics as confirmed.
- [ ] `LoansController`/`InstallmentsController` responses expose the per-installment charge breakdown keyed by concept name, shaped for the dynamic table the client app renders.
- [ ] Fix the amortizador calculation discrepancy identified against Juan's manual figures — root-cause it, don't paper over it with a rounding tweak.
- [ ] `ModulePermissionsGuard`: decouple "can create a loan" from "can view the amortizador/concept breakdown" so a collector with only the `loans` grant (not `interest_concept_types`) can still create a loan.

### Tests (mandatory)
- [ ] Fixed-amount concept: `split_across_installments` divides the total correctly across every installment (including remainder handling, same convention as the existing declining-balance rounding rule); `first_installment_only` charges the full amount once, zero on every other installment.
- [ ] Moratory concept computation matches the previously-confirmed formula's numeric output for at least one real example from `LIBRO_PARA_COBRAR.xlsx`, to guarantee no silent regression during the migration off the hardcoded formula.
- [ ] A collector without `interest_concept_types` permission can still call `POST /loans`; one without `loans` permission still cannot.
- [ ] Amortizador discrepancy: a regression test pinned to the specific example that previously diverged from Juan's number.

### Swagger
- [ ] Updated concept/loan/installment DTOs and response shapes documented.

## Definition of done for this phase

- Moratory interest is priced through `InterestConceptType`/`LoanInstallmentConcept`, not the hardcoded formula.
- A fixed-amount concept's distribution mode is explicit, correct, and covered by tests.
- The loan detail view's data (charge-by-installment) is shaped for a dynamic per-charge table, not a fixed set of columns.
- The amortizador's discrepancy against Juan's manual numbers is resolved, not just documented.
- A collector can create a loan without the `interest_concept_types` permission grant.
- All items in `docs/DEFINITION_OF_DONE.md` checklist pass.

## After this phase

Update `docs/DATABASE.md` (`interest_concept_types`, `loan_installment_concepts` new columns; mark `loans.interest_rate` superseded) and `docs/GLOSSARY.md` ("Interest / Interés (mora interest)" section, which currently documents the formula this phase replaces).

## Related documents

- `docs/phases/PHASE_14_INTEREST_CONCEPTS.md` — the concept engine this phase extends
- `docs/phases/PHASE_23_USURY_MANDATORY.md` — depends on this phase's `category` split
- `docs/DATABASE.md`, `docs/GLOSSARY.md`
