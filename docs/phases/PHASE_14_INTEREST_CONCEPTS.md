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
6. **Added after the client's follow-up ("Amortizador detallado" observation):** the client explicitly wants concepts to be admin-manageable without a code change per new concept — "el administrador pueda cambiar tanto los porcentajes, como los conceptos según sea necesario." A per-loan free-text `name` (as scoped below) technically allows any name, but gives the admin no reusable catalog — they'd retype "GASTOS DE COBRANZA" on every single loan with no central place to rename it or adjust its default rate. Confirm: does the client want a global, admin-editable **catalog** of reusable concept types (recommended — see `InterestConceptType` below) that each loan then selects from and can override, rather than pure per-loan free text?
7. **Added after the client's "Amortizador de financiamiento" note (meeting follow-up, confirmed in scope — see "Quote/simulator tool" below):** should a generated quote be persisted (its own record, kept for accountability — "we told this prospect X, here's proof") or is it a pure live calculator with no database footprint, where the actual requirement is just that its math is guaranteed identical to what a real `Loan` would compute (never a discrepancy between what was shown and what gets charged if the prospect actually takes the loan)? The client's phrasing ("no podemos cambiar la información más adelante") could mean either. Confirmed as explicitly in scope for this phase, deferred until the catalog question (6) above is resolved, per the client's own request — the quote tool's concept/percentage handling depends entirely on that answer.

**Do not pick answers and build it — ask the human.** This is exactly the kind of ambiguous financial rule `apps/api/CLAUDE.local.md` says never to guess.

## Market research — completed (client requested, not a substitute for confirming the above)

The client asked us to look at how Sistecrédito and Addi name these concepts, "para acuñar los mismos términos." Findings, informational only:

- **Addi** (closest comparable — Colombian fintech, small/short-term consumer credit) publishes an actual rate sheet with three cost buckets: **"Tasa de interés"** (remuneratory, varies by risk profile), **"Respaldo (fianza)"** — a guarantee/backing fee paid to a third-party guarantee fund, charged as a percentage + IVA of the purchase amount, payable diluted across installments — and **"Gastos de cobranza"**, an explicit tiered percentage of overdue capital that increases with days overdue (10-30, 31-60, 61-90, 91-120 días), each tier with its own min/max peso caps, charged from day 10 of mora. Source: [Addi — Tasas y tarifas](https://co.addi.com/tasas-tarifas).
- **Sistecrédito** charges a monthly interest rate plus an **"Aval"** (guarantee) fee plus IVA, both scaled to the client's risk profile — and is legally required to disclose, before the client accepts, the "tasa de interés remuneratoria," "tasa de interés moratoria," "tasa máxima legal vigente," "valores o cargos adicionales," "garantías, avales o servicios accesorios," and "gastos de cobranza" as distinct line items. Source: [Sistecrédito — Información para el consumidor](https://www.sistecredito.com/informacion-para-el-consumidor/).
- Broader Colombian consumer-credit market terminology (credit cards, via Bold's educational content): **"cuota de manejo"** (recurring account/handling fee), **"seguros asociados"** (bundled insurance — life, unemployment, purchase protection), **"comisión por estudio de crédito"** (one-time application/underwriting fee). Source: [Bold — Costos de las tarjetas de crédito en Colombia](https://bold.co/academia/educacion-financiera/tarjetas-de-credito-en-colombia-costos-y-tarifas-asociadas).

**Suggested initial catalog** (pending the client's actual go-ahead on which to use, and on the catalog question above) — mapping the client's own proposed concepts to closer market-standard naming where one exists:

| Client's term | Closer market equivalent (optional swap) | Notes |
|---|---|---|
| Gastos de cobranza | Same term — this is already the standard name (Addi uses it verbatim, with an explicit tiered-by-mora-days structure worth mirroring) | Confirm if a flat % or Addi-style tiered-by-days structure is wanted — the latter is more work (ties into per-installment mora days) |
| Uso de plataforma | "Cuota de manejo" is the closer market-recognized term for a recurring platform/account fee | Client's own phrasing may poll better with their specific customer base — this is a suggestion, not a requirement |
| Comisión de pagos virtuales | Matches "comisión" terminology used broadly (e.g. comisión por estudio de crédito) | No direct market equivalent for this exact concept — client's phrasing is already clear |
| Mensajería express personalizada de notificación | No market equivalent found — appears specific to this business | Keep as-is |
| (not yet proposed by client) | "Respaldo" / "Aval" — a guarantee fee, used by both Addi and Sistecrédito | Worth asking the client if they want an equivalent concept, since it's standard in this exact market segment |

## Required reading before starting

`docs/GLOSSARY.md`, `docs/DATABASE.md` (interest rate open question — this phase likely resolves or reshapes it), `docs/phases/PHASE_4_LOANS_INSTALLMENTS.md` (current loan/installment model this phase extends).

## Scope (once the above is confirmed)

### Entities and migrations
- [ ] `InterestConceptType` entity (pending confirmation of open question 6 above): `id`, `name` (VARCHAR, e.g. "Gastos de cobranza", "Uso de plataforma"), `default_calculation_type` (enum: `percentage` | `fixed_amount`), `default_value` (DECIMAL), `is_active` (BOOLEAN), timestamps. **Admin-managed catalog** — CRUD via `/interest-concept-types`, admin only, mirroring the CRUD-ability `MessageTemplatesController` used to have before Phase 9 made it static (this is the opposite case: these concepts must stay freely editable, since the client's explicit ask is to never need a code change to add/rename/reprice one).
- [ ] `LoanInterestConcept` entity: `id`, `loan_id` (FK → `loans`), `concept_type_id` (FK → `interest_concept_types`, nullable if a one-off, non-catalog concept is still allowed — confirm), `name` (VARCHAR, defaults from the selected type but overridable per loan — e.g. a one-time discount on "gastos de cobranza" for a specific client), `calculation_type` (enum: `percentage` | `fixed_amount`), `value` (DECIMAL), timestamps + soft delete, same conventions as `installments`. One loan has many concepts (1:N); selecting a type pre-fills name/calculation_type/value, all of which remain editable per loan.
- [ ] Migration `CreateInterestConceptTypesTable`, then `CreateLoanInterestConceptsTable`.
- [ ] Decide, per the confirmed answers above, whether `Loan.interest_rate` is kept as-is (untouched, moratory-only) with concepts additive on top, or whether concepts subsume it. This entirely determines whether `installmentCalculations.ts`/`enrichInstallment.ts` need any changes in this phase.

### Loan creation and refinancing
- [ ] `LoansService.create()` / `refinance()`: accept `interestConcepts: CreateInterestConceptDto[]` alongside existing loan fields.

### Reporting
- [ ] New computed field per installment, `conceptBreakdown: { name, amount }[]`, exposed via `GET /api/v1/loans/:id` and `GET /api/v1/installments` — calculated on read, not persisted, same pattern as existing mora fields.

### Quote / simulator tool ("amortizador proyector" — confirmed in scope, client meeting follow-up)
The client's actual use case, in their own words: a prospect walks into the office asking "how much would I pay if I borrowed $X over Y months," and the person helping them needs to turn the screen around and show a clear, large breakdown on the spot — **before** any `Loan` record exists.
- [ ] `POST /api/v1/loans/quote` (or similar — not a persisted resource unless open question 7 resolves to "yes, persist it"): accepts the same shape as loan creation (`principalAmount`, `totalInstallments`, `installmentFrequency`, `interestConcepts`) minus `clientId`/`promissoryNoteNumber`, and returns the exact same per-installment breakdown shape `LoansService.create()` would produce — **must reuse the identical calculation code path** as real loan creation, not a parallel reimplementation, so a quote can never drift from what an actual loan would compute.
- [ ] If open question 7 resolves to "persist it": a `LoanQuote` entity/table capturing what was shown and when, so the business has a record if a prospect later disputes what they were quoted. If it resolves to "pure calculator": no new table, this endpoint is stateless.

### Tests (mandatory)
- [ ] Concept creation validated against whatever base/type rules were confirmed.
- [ ] `conceptBreakdown` sums correctly to the installment's total.
- [ ] Existing loans without concepts continue to work exactly as before (backward compatibility per the migration decision above).
- [ ] The quote endpoint's output is byte-for-byte identical to what `LoansService.create()` would produce for the same inputs — the single most important test in this phase per the client's explicit "no podemos cambiar la información más adelante" requirement.
- [ ] A loan's stored concept values never change when the `InterestConceptType` catalog is edited afterward — confirms open question 6/answer B (see below) is actually enforced, not just assumed.

### Swagger
- [ ] New entity, DTOs, and computed fields documented.

## Definition of done for this phase

- A loan can be created with multiple named interest/fee concepts instead of a single flat rate.
- The exact breakdown of what a client owes, by concept, is retrievable per installment.
- **Confirmed (client, "Amortizador de financiamiento" note, part B):** once a loan is created, its concepts' names/types/values are frozen — editing the `InterestConceptType` catalog afterward must never retroactively change an already-created loan's numbers. This was already the natural consequence of `LoanInterestConcept` storing its own copied values rather than a live reference, but is now a confirmed, explicit requirement, not just an implementation detail — the client is relying on this specifically for point A below.
- **Confirmed (client, "Amortizador de financiamiento" note, part A):** an admin can generate an on-the-spot quote for a prospective client — principal, term, and concepts in, a clear per-installment breakdown out — without creating a `Loan` record, and that quote's math is guaranteed to exactly match what a real loan would produce for the same inputs.
- The confirmed answers to every "Before starting" question are implemented exactly as agreed — not guessed.
- All items in `docs/DEFINITION_OF_DONE.md` checklist pass.

## After this phase

Update `docs/DATABASE.md` (new `interest_concept_types` and `loan_interest_concepts` tables, and the resolved/reshaped `interest_rate` open question) and `docs/GLOSSARY.md` (add "Interest concept / Concepto de interés", update "Interest rate / Tasa de mora" if its meaning changed).

## Important cross-reference — Phase 15 must validate the total, not just "interés"

The client's own stated reason for wanting configurable concepts is to avoid charging everything under the single label "interés," which would otherwise breach `docs/phases/PHASE_15_USURY_RATE.md`'s legal ceiling. This means Phase 15's open question #2 ("does the ceiling validate only the nominal interest concepts, or the effective total cost including moratory interest and any fixed fees?") is no longer a neutral toggle — if Phase 15 ends up validating only a field literally named "interés," the usury-ceiling check becomes meaningless by construction, since it would never see the concepts specifically designed to sit outside that label. Whoever confirms Phase 15's open questions with the client should confirm this explicitly, and be told this isn't a minor implementation detail — it determines whether the ceiling check does anything at all. Not legal advice; if there's any doubt about whether structuring charges this way is itself compliant, that's a question for the client's own legal/financial advisor, not something to infer from this codebase.

## Related documents

- `docs/phases/PHASE_4_LOANS_INSTALLMENTS.md` — current loan/installment model
- `docs/phases/PHASE_15_USURY_RATE.md` — the legal ceiling this phase's concepts must be validated against (see cross-reference above)
- `docs/DATABASE.md` — open question on `interest_rate` this phase addresses
