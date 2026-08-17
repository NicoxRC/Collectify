# Phase 14 — Configurable Interest Concepts (Amortizador)

## Goal

Today a loan has exactly one `interest_rate` field, used exclusively to calculate moratory interest on overdue installments — there is no "ordinary" interest charged on principal at all, and installment amounts are hand-entered totals with no capital/interest split. Colombian law caps how much can legally be charged and labeled as interest (see `docs/phases/PHASE_15_USURY_RATE.md`), so in practice lending businesses charge part of the cost of the loan under other named concepts (e.g. "gastos de cobranza", administrative fees) rather than as a single interest percentage. This phase replaces manual installment-amount entry with a real amortization schedule: the admin defines the principal, term, and a set of interest/fee concepts (picked from an admin-managed, extensible catalog — not a fixed list), and the system computes every installment's amount, split into capital and each concept's contribution, on a declining balance.

## ⚠️ Size warning — read before scoping implementation work

This is confirmed as the largest phase in this batch — the human confirmed the system must generate the full amortization schedule automatically, on a declining balance, with concepts that can vary installment-to-installment. This is a real amortization engine, replacing `docs/phases/PHASE_4_LOANS_INSTALLMENTS.md`'s original decision that "there is no automatic even-split; the caller provides one amount per installment." **Treat this as reopening that decision, not new scope in isolation** — the same courtesy given to Phase 17's reopening of Phase 6. Given the confirmed size, still consider splitting the implementation into two PRs (data model + catalog CRUD first, generation algorithm second) even though the scope itself is no longer ambiguous.

## Resolved — confirmed directly with the human

The open questions this phase originally carried are now resolved. Recorded here (not silently deleted) so a future reader can see what was decided and why, matching the project's convention for this kind of ambiguous financial rule:

- ~~Is a "concepto" a percentage on some base, a fixed fee, or both?~~ → **Confirmed: percentage-type concepts are calculated on the outstanding balance at the start of each installment period** (declining balance, not a one-time calculation on the original principal). Fixed-amount concepts are a flat figure per installment, unaffected by balance.
- ~~Does this introduce ordinary/remuneratory interest on principal?~~ → **Confirmed: yes.** This is genuinely new — the system has only ever charged moratory interest before this phase.
- ~~Are installment amounts still hand-entered, or does the system compute them?~~ → **Confirmed: the system computes them.** The admin no longer types a total per installment — they define principal, term, frequency, and concepts, and the schedule is generated. This directly reopens `docs/phases/PHASE_4_LOANS_INSTALLMENTS.md`'s "no automatic even-split" decision.
- ~~Are concepts identical across every installment, or can they vary?~~ → **Confirmed: they can vary installment-to-installment**, the same way `installment_amounts` already could before this phase. In practice most loans will use the same concepts throughout, but the data model must not assume that.
- ~~How do existing loans migrate?~~ → **Not applicable — nothing is in production yet**, confirmed directly by the human. No backward-compatibility or backfill work is needed; this phase can assume a clean slate.
- ~~Can an admin edit/deactivate a concept type already used on existing loans — snapshot or live?~~ → **Confirmed: snapshot.** A loan's installments keep the concept name/value they were generated with, even if the catalog entry is later edited or deactivated. Deactivating a type only removes it from the picker for *new* loans.

## Scope decisions — read before implementing

- **Concept types are admin-managed and dynamic, not a fixed/hardcoded list.** The admin must be able to create new kinds of interest/fee concepts at any time (e.g. add a "Seguro" concept next year without a code change). Implemented as a small admin-managed catalog (`InterestConceptType`), not free text — a catalog keeps names consistent across loans (needed for future reporting like "total gastos de cobranza cobrados este mes") while still letting the admin add a brand-new type inline at loan-creation time.
- **Principal is amortized in even installments (linear/"German"-style), not a level total payment ("French"-style).** This is an implementation judgment call, not something the human was asked directly — flagged here so it can be corrected if it doesn't match business reality. Reasoning: since concepts (and therefore the interest/fee portion of each installment) can vary installment-to-installment, a level *total* payment across the whole term isn't well-defined in general — solving for one would require assumptions this project has no basis for. Evenly dividing principal across installments keeps the calculation simple and deterministic regardless of how concepts vary, and each installment's total is still `principal_portion + that period's concept charges`, which is what "consultable por cuota" requires. **Revisit this specific mechanic with the human if the business actually needs level (equal) total payments** — that would require a different, iterative calculation.

## Required reading before starting

`docs/GLOSSARY.md`, `docs/DATABASE.md` (interest rate open question — this phase resolves it), `docs/phases/PHASE_4_LOANS_INSTALLMENTS.md` (the installment-generation decision this phase reopens).

## Scope

### Entities and migrations
- [ ] `InterestConceptType` entity (the admin-managed catalog): `id`, `name` (VARCHAR — e.g. "Interés remuneratorio", "Gastos de cobranza"), `default_calculation_type` (enum: `percentage` | `fixed_amount`), `default_value` (DECIMAL, nullable — a suggested starting value, always overridable per installment), timestamps + soft delete.
- [ ] `LoanInstallmentConcept` entity (per installment, not per loan, since concepts can vary installment-to-installment): `id`, `installment_id` (FK → `installments`), `interest_concept_type_id` (FK → `interest_concept_types`), `name_snapshot` (VARCHAR, copied from the type at generation time), `calculation_type` (enum, snapshotted), `rate_or_fixed_value` (DECIMAL, snapshotted — the % or flat figure used), `computed_amount` (DECIMAL — the actual currency amount this concept contributed to this installment, calculated once at generation time against the balance at that point, then stored — installment schedules don't change with the passage of time the way mora does).
- [ ] `Installment`: add `principal_portion` (DECIMAL — the capital-only part of this installment's total `amount`). This is what `docs/phases/PHASE_16_EARLY_PAYOFF.md` and `docs/phases/PHASE_17_REFINANCING_RECALC.md` need to compute "interest caused vs. principal remaining."
- [ ] Migrations: `CreateInterestConceptTypesTable`, `CreateLoanInstallmentConceptsTable`, `AddPrincipalPortionToInstallments`.
- [ ] `Loan.interest_rate` is no longer used for new loans created after this phase ships — new loans express their entire cost through concepts instead. It is not removed from the schema (existing behavior for anything still reading it is untouched, and moratory calculation below still needs a rate — see next item).
- [ ] Decide, alongside `docs/phases/PHASE_15_USURY_RATE.md`, whether moratory interest (still calculated by `installmentCalculations.ts` on overdue installments) now uses one of the loan's own concepts as its base rate, or keeps its own independent mechanism — flag this explicitly when scoping Phase 15's implementation, don't silently duplicate a rate.

### Concept type management (admin catalog)
- [ ] `InterestConceptTypesService`: `create()`, `findAll()` (active types, for the loan-creation picker), `update()`, `deactivate()` — admin only.
- [ ] `POST /api/v1/interest-concept-types`, `GET /api/v1/interest-concept-types`, `PATCH /api/v1/interest-concept-types/:id`, `PATCH /api/v1/interest-concept-types/:id/deactivate` — admin only.

### Amortization generation
- [ ] `loans/amortization/generateSchedule.ts` — pure function, sibling to `installmentCalculations.ts`, unit-tested the same way as `installmentCalculations.spec.ts`. Input: `principalAmount`, `totalInstallments`, `installmentFrequency`, `firstInstallmentDueDate`, and a per-installment list of concept assignments (`{ conceptTypeId, calculationType, value }[]` for each installment index — defaulting to the same set for every installment unless the admin overrides specific ones). Algorithm:
  1. `principalPortion = principalAmount / totalInstallments`, with any rounding remainder absorbed into the **last** installment (mirrors how `assertInstallmentAmountsMatchPrincipal` already tolerates a small delta today).
  2. `runningBalance = principalAmount`.
  3. For each installment `i` from 1 to N, in order:
     - For each of installment `i`'s assigned concepts: if `percentage`, `computedAmount = runningBalance × (value / 100)`; if `fixed_amount`, `computedAmount = value`.
     - `installment.amount = principalPortion (or remaining balance on the last installment) + sum(computedAmount across this installment's concepts)`.
     - Store the `LoanInstallmentConcept` rows for this installment with their snapshotted values.
     - `runningBalance -= principalPortion` (this is the balance the *next* installment's percentage concepts apply to).
- [ ] `LoansService.create()` / `refinance()`: replace the current `installmentAmounts[]` input with `{ principalAmount, totalInstallments, installmentFrequency, firstInstallmentDueDate, installmentConcepts }`, call `generateSchedule()`, persist the resulting installments and their concepts.

### Reporting
- [ ] `GET /api/v1/loans/:id` and `GET /api/v1/installments`: each installment response includes `principalPortion` and `conceptBreakdown: { name, amount }[]` (from the stored `LoanInstallmentConcept` rows — no need to recalculate, they were computed once at generation time).

### Tests (mandatory)
- [ ] `generateSchedule()`: single concept flat across all installments (balance declines correctly, sums to principal exactly); concepts that vary per installment; a mix of percentage and fixed-amount concepts; rounding remainder lands on the last installment; a single-installment loan.
- [ ] `InterestConceptTypesService`: create/update/deactivate; a deactivated type no longer appears in `findAll()` but existing `LoanInstallmentConcept` rows referencing it are unaffected (snapshot behavior).
- [ ] `LoansService.create()`/`refinance()`: generated installments' `principalPortion` values sum exactly to `principalAmount`.

### Swagger
- [ ] New entities, DTOs, catalog endpoints, and the updated loan-creation payload documented, including a clear explanation of the amortization algorithm in the description.

## Definition of done for this phase

- An admin can create a new interest/fee concept type at any time, without a code change or deployment.
- A loan can be created by specifying principal, term, and concepts — the system generates every installment's amount, with its capital/concept breakdown, automatically.
- The exact breakdown of what a client owes, by concept, is retrievable per installment without recalculating anything.
- All items in `docs/DEFINITION_OF_DONE.md` checklist pass.

## After this phase

Update `docs/DATABASE.md` (new `interest_concept_types`, `loan_installment_concepts` tables, `installments.principal_portion` column, and resolve the `interest_rate` open question — note it's superseded by concepts for loans created after this phase) and `docs/GLOSSARY.md` (add "Interest concept type / Tipo de concepto de interés" and "Interest concept / Concepto de interés"; update "Interest rate / Tasa de mora" to reflect that ordinary interest is now concept-based). Also update `docs/phases/PHASE_4_LOANS_INSTALLMENTS.md`'s own text to note its "no automatic even-split" decision was superseded here, so the two documents don't silently contradict each other.

## Related documents

- `docs/phases/PHASE_4_LOANS_INSTALLMENTS.md` — the installment-generation decision this phase supersedes
- `docs/phases/PHASE_15_USURY_RATE.md` — the legal ceiling this phase's concepts must be validated against
- `docs/phases/PHASE_16_EARLY_PAYOFF.md`, `docs/phases/PHASE_17_REFINANCING_RECALC.md` — both consume `principal_portion` introduced here
- `docs/DATABASE.md` — open question on `interest_rate` this phase resolves
