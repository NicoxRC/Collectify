# Phase 14 — Configurable Interest Concepts (Amortizador)

## Goal

Today a loan has exactly one `interest_rate` field, used exclusively to calculate moratory interest on overdue installments — there is no "ordinary" interest charged on principal at all. Colombian law caps how much can legally be charged and labeled as interest (see `docs/phases/PHASE_15_USURY_RATE.md`), so in practice lending businesses charge part of the cost of the loan under other named concepts (e.g. "gastos de cobranza", administrative fees) rather than as a single interest percentage. This phase lets a loan be created with several such named concepts instead of one flat rate, and lets the exact breakdown be shown per installment when a client asks what they owe and why.

## ⚠️ Size warning — read before scoping implementation work

This is the largest, highest-uncertainty phase in this batch of ten. Read literally, "several concepts with an exact breakdown consultable per installment" edges very close to building a real amortization engine — something this system has never had. Today's `installmentAmounts` are hand-entered totals with no principal/interest split whatsoever (`docs/phases/PHASE_4_LOANS_INSTALLMENTS.md` deliberately chose "no automatic even-split; the caller provides one amount per installment" as its scope). If, once the "Before starting" questions below are answered, the real scope turns out to require automatic amortization calculation, **split this phase into two**: a first phase for the data model + manual concept entry at loan creation, and a second for automatic per-installment breakdown/amortization math. Do not silently absorb both into one PR because they're described in one document.

## Before starting this phase — stop and confirm with the human

None of these are guessable from the current code, and getting them wrong means rebuilding the data model:

1. Is a "concepto" a percentage applied to some base (principal? per-installment amount? outstanding balance?), a fixed fee, or can both types coexist on the same loan?
2. Does this introduce **ordinary/remuneratory interest on principal** — something the system has never charged, since today's only interest is moratory — or is it purely relabeling/splitting today's single `interest_rate` into named parts that still only apply to overdue amounts?
3. If ordinary interest on principal is now in scope: are `installment_amounts` still hand-entered totals (the admin also tags a breakdown after the fact), or does the system need to *compute* an amortization schedule automatically? These are very different amounts of work — confirm explicitly, don't let "consultable por cuota" default to the bigger interpretation.
4. Are concepts identical across every installment in a loan, or can they vary installment-to-installment the way `installment_amounts` already can?
5. How do existing loans (single `interest_rate`, no concepts) render or migrate — backfilled into one "Interés" concept, or left in their current shape indefinitely?

**Do not pick answers and build it — ask the human.** This is exactly the kind of ambiguous financial rule `apps/api/CLAUDE.local.md` says never to guess.

## Required reading before starting

`docs/GLOSSARY.md`, `docs/DATABASE.md` (interest rate open question — this phase likely resolves or reshapes it), `docs/phases/PHASE_4_LOANS_INSTALLMENTS.md` (current loan/installment model this phase extends).

## Scope (once the above is confirmed)

### Entities and migrations
- [ ] `LoanInterestConcept` entity: `id`, `loan_id` (FK → `loans`), `name` (VARCHAR — e.g. "Interés remuneratorio", "Gastos de cobranza"), `calculation_type` (enum: `percentage` | `fixed_amount`), `value` (DECIMAL), timestamps + soft delete, same conventions as `installments`. One loan has many concepts (1:N).
- [ ] Migration `CreateLoanInterestConceptsTable`.
- [ ] Decide, per the confirmed answers above, whether `Loan.interest_rate` is kept as-is (untouched, moratory-only) with concepts additive on top, or whether concepts subsume it. This entirely determines whether `installmentCalculations.ts`/`enrichInstallment.ts` need any changes in this phase.

### Loan creation and refinancing
- [ ] `LoansService.create()` / `refinance()`: accept `interestConcepts: CreateInterestConceptDto[]` alongside existing loan fields.

### Reporting
- [ ] New computed field per installment, `conceptBreakdown: { name, amount }[]`, exposed via `GET /api/v1/loans/:id` and `GET /api/v1/installments` — calculated on read, not persisted, same pattern as existing mora fields.

### Tests (mandatory)
- [ ] Concept creation validated against whatever base/type rules were confirmed.
- [ ] `conceptBreakdown` sums correctly to the installment's total.
- [ ] Existing loans without concepts continue to work exactly as before (backward compatibility per the migration decision above).

### Swagger
- [ ] New entity, DTOs, and computed fields documented.

## Definition of done for this phase

- A loan can be created with multiple named interest/fee concepts instead of a single flat rate.
- The exact breakdown of what a client owes, by concept, is retrievable per installment.
- The confirmed answers to every "Before starting" question are implemented exactly as agreed — not guessed.
- All items in `docs/DEFINITION_OF_DONE.md` checklist pass.

## After this phase

Update `docs/DATABASE.md` (new `loan_interest_concepts` table, and the resolved/reshaped `interest_rate` open question) and `docs/GLOSSARY.md` (add "Interest concept / Concepto de interés", update "Interest rate / Tasa de mora" if its meaning changed).

## Related documents

- `docs/phases/PHASE_4_LOANS_INSTALLMENTS.md` — current loan/installment model
- `docs/phases/PHASE_15_USURY_RATE.md` — the legal ceiling this phase's concepts must be validated against
- `docs/DATABASE.md` — open question on `interest_rate` this phase addresses
