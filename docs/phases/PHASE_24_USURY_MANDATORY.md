# Phase 24 — Usury Rate Becomes Mandatory and Self-Applied

## Goal

Turn the usury ceiling from an admin-informational warning (Phase 15) into the actual, non-editable value used to price a loan's interest-bearing concepts — and block loan creation entirely when the current month's rate hasn't been entered yet.

## Depends on

`docs/phases/PHASE_23_DYNAMIC_CHARGES.md` — moratory interest must already be priced through `InterestConceptType`/`LoanInstallmentConcept` (with the `category` split that phase adds) before this phase can auto-fill both corriente and moratorio concepts with the usury rate. Do not start this phase before Phase 23 ships.

## Resolved — confirmed directly with the human (reunión 2026-08-25)

1. **Hard block on missing rate:** "no se puede crear un crédito sin que se haya agregado la tasa de usura." `LoansService.create()`/`refinance()` must reject the request outright (not just warn) when `UsuryRateService.getCurrentRate().isStale` is true or no rate exists at all — this is a stricter rule than Phase 15's "warning only, creation-time check" design, and explicitly supersedes it.
2. **Remove the exceeded-ceiling warning:** "se debe quitar advertencia cuando se supera la tasa de usura." Once a loan's interest-bearing concepts are priced at exactly the ceiling (see below), they can no longer exceed it by construction, so `Loan.usuryCeilingExceededAtCreation`/`usuryJustification` and the warning banner become dead code paths for interest-bearing concepts specifically.
3. **Auto-applied, non-editable, but visible:** "la tasa de usura se mete automáticamente en los cargos del crédito (intereses corrientes y moratorios). No se puede editar pero se debe mostrar visualmente al crear el crédito." The current month's certified rate becomes the value of every interest-bearing (`category: corriente` or `moratorio`) concept applied to a loan — the admin can no longer type a different percentage for those, though they still see the value at creation time.

## Open questions — confirm before implementing

- [ ] **Do fixed-amount concepts (e.g. "Gastos de cobranza") stay admin-set, untouched by this rule?** The resolved answer above only mentions interest-bearing concepts ("intereses corrientes y moratorios"); Phase 15's ceiling check already counted fixed fees toward the *comparison*, but this phase's auto-fill is a different, stronger rule (setting the value, not just checking it) — confirm fixed-amount concepts are explicitly out of scope for auto-fill before writing code that touches them.
- [ ] **What happens to `usuryCeilingExceededAtCreation`/`usuryJustification` as columns** — removed entirely (migration to drop them) or just unused going forward (kept for historical loans created under Phase 15's rules)? Given this project's migration policy (`docs/DATABASE.md` "Migrations" — no `synchronize: true`, deliberate schema changes), recommend keeping the columns for historical loans and simply retiring the code path that writes to them for new loans, but confirm with the human before dropping anything that already has real data.
- [ ] Is the auto-filled percentage exactly `UsuryRate.ratePercentage`, or some derived value (e.g. split between corriente and moratorio so their sum doesn't exceed the ceiling)? The resolved wording ("se mete automáticamente en los cargos... intereses corrientes y moratorios," plural) is ambiguous between "each of those concepts individually equals the ceiling" and "together they must not exceed it" — these produce very different amounts owed and must not be guessed.

## Required reading before starting

`docs/phases/PHASE_15_USURY_RATE.md` (the enforcement model this phase replaces), `docs/phases/PHASE_23_DYNAMIC_CHARGES.md` (the concept `category` split this phase relies on), `docs/DATABASE.md` (`usury_rates`, `loans` usury columns).

## Scope (once the open questions above are confirmed)

### Entities and migrations
- [ ] No new columns anticipated beyond what Phase 23 adds — this phase changes *behavior*, not shape, pending resolution of the "drop vs. retire" open question on the existing usury warning columns.

### Service and API
- [ ] `LoansService.persistLoanWithInstallments()`: replace the current warning-only usury check with a hard rejection (`BadRequestException` or similar) when no current-month rate is on file.
- [ ] Wherever `LoanInstallmentConcept`s are generated for `category: corriente`/`moratorio` concepts, source their `value` from `UsuryRateService.getCurrentRate()` instead of an admin-supplied figure — reject any request that tries to override it.
- [ ] `POST /loans/preview-schedule` reflects the same auto-filled, non-overridable value, so what the admin previews at creation time matches what gets persisted.
- [ ] Remove (or stop writing to, per the open question above) the exceeded-ceiling warning path.

### Tests (mandatory)
- [ ] Loan creation is rejected when no usury rate exists for the current month, and when the existing rate is stale (prior month).
- [ ] An interest-bearing concept's persisted value always equals the current usury rate, regardless of what the request body attempts to send for it.
- [ ] `POST /loans/preview-schedule` shows the same auto-filled value a subsequent `POST /loans` would persist.
- [ ] The exceeded-ceiling warning can no longer be produced for a newly created loan.

### Swagger
- [ ] `POST /loans`/`POST /loans/:id/refinance`/`POST /loans/preview-schedule` descriptions updated to state the hard-block rule and the non-editable auto-filled rate, replacing the old warning-only language.

## Definition of done for this phase

- A loan cannot be created or refinanced without the current month's usury rate on file.
- Interest-bearing concepts are priced at exactly the confirmed auto-filled value, not admin-editable.
- The exceeded-ceiling warning is no longer reachable for new loans.
- The confirmed rules are implemented exactly as agreed with the human — not guessed on the open questions above.
- All items in `docs/DEFINITION_OF_DONE.md` checklist pass.

## After this phase

Update `docs/DATABASE.md`'s `usury_rates`/`loans` sections and "Enforcement" language in the (retired) Phase 15 warning flow, and `docs/GLOSSARY.md`'s "Tasa de usura" entry to describe the hard-block, self-applied rule.

## Related documents

- `docs/phases/PHASE_15_USURY_RATE.md` — the warning-only model this phase replaces
- `docs/phases/PHASE_23_DYNAMIC_CHARGES.md` — the concept `category` split this phase depends on
- `docs/DATABASE.md`, `docs/GLOSSARY.md`
