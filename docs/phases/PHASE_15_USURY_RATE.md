# Phase 15 — Usury Rate Ceiling (Tasa de Usura Global)

## Goal

Track Colombia's legal usury ceiling as a global, month-to-month value, and apply it automatically to moratory interest calculations instead of leaving `interest_rate` as an unchecked per-loan number with no relationship to what's actually legal.

## Domain research (informational — not a substitute for legal confirmation)

- Colombia's usury rate ("tasa de usura") is calculated as **1.5× the "Interés Bancario Corriente" (IBC)**, certified **monthly** by the Superintendencia Financiera de Colombia. It is a single national ceiling, not per-institution or per-product. Charging above it is a criminal offense under the Colombian Penal Code.
- Because it's certified monthly and changes (e.g. it moved from ~24% to ~29% effective annual rate across different months in past cycles), it cannot be hardcoded — it must be an admin-editable, dated value, which is exactly what the user asked for ("que se pueda actualizar mes a mes").
- There is no official free API for this value as of this research — the realistic implementation is an admin manually entering the new month's certified rate, not automated scraping.
- **Publication timing is not a fixed calendar day.** Confirmed directly from the SFC's own resolution (e.g. August 2026's Resolución 1139 was published July 31, based on bank data reported through the week of July 24 — i.e. right after the last full reporting week of the prior month closes, not on a predetermined day number). A reminder tied to a fixed day (e.g. "the 5th of each month") would be unreliable — some months it publishes on the 28th, others the 30th or 31st, shifting around weekends/holidays. **This is why the staleness check below compares against the current calendar month rather than a specific day.**

This research grounds the phase but does **not** replace the "Before starting" confirmation below — the exact enforcement mechanics are a real legal/business decision, not something to infer from general research.

## Before starting this phase — stop and confirm with the human

1. Is this a single global value, or does it need to vary by credit modality (Colombian usury certification sometimes differentiates by type of credit)?
2. Does the ceiling validate only the nominal interest concepts from Phase 14, or the effective total cost including moratory interest and any fixed fees? **This is not a neutral choice** — see `docs/phases/PHASE_14_INTEREST_CONCEPTS.md`'s "Important cross-reference" note: the client's stated reason for wanting configurable concepts is to charge part of the loan's real cost under labels other than "interés" specifically to stay under this ceiling nominally. If this question resolves to "only the field named interés," this phase's validation would never see the concepts it most needs to catch.
3. On violation: hard block at loan-creation time, or a warning an admin can override with justification?
4. Should moratory interest be automatically capped at the current usury rate on every read (so an overdue calculation never legally exceeds it even against a stale per-loan rate), or is this purely a creation-time validation gate?
5. If the monthly rate changes, does it apply retroactively to interest already accrued on existing overdue installments, or only to interest accruing from that point forward?

**Do not pick answers and build it — ask the human.** Question 5 in particular determines whether a single mutable value or a dated history table is the right shape — see below for why a history table is recommended regardless, but the exact retroactivity rule still needs confirmation.

## Required reading before starting

`docs/DATABASE.md` (interest rate / mora sections), `docs/phases/PHASE_14_INTEREST_CONCEPTS.md` (this phase validates against its concept model).

## Scope (once the above is confirmed)

### Entities and migrations
- [ ] `UsuryRate` entity: `id`, `effective_month` (DATE), `rate_percentage` (DECIMAL), `created_by` (FK → `users`), `created_at`. **Historical rows, not a single mutable value** — preserving past months' rates makes it possible to correctly answer whatever retroactivity rule gets confirmed, without having overwritten the evidence.
- [ ] Migration `CreateUsuryRatesTable`.

### Service and API
- [ ] `UsuryRateService.getCurrentRate()`, `.setRate(dto)` (admin only, creates a new month's entry rather than mutating an existing one), `.getRateForMonth(date)` for historical lookups.
- [ ] `POST /api/v1/usury-rates` — admin only.
- [ ] `GET /api/v1/usury-rates/current`, `GET /api/v1/usury-rates` (history, admin only).

### Stale-rate alert (confirmed with the client — publication timing follow-up)
Since the SFC doesn't publish on a fixed day (see domain research above), a day-based reminder isn't reliable. Instead:
- [ ] `GET /api/v1/usury-rates/current`'s response includes `isStale: boolean` — true when the most recent row's `effective_month` is not the current calendar month (i.e. nobody has entered this month's certified rate yet, whether it's the 1st or the 20th). Computed on read by comparing `effective_month` to today's year-month, not stored.
- [ ] No cron/scheduled job needed for this — it's a plain computed comparison, checked whenever the admin loads the relevant screen.

### Enforcement
- [ ] Validation hook into `LoansService.create()` (Phase 14's concept creation) and/or `enrichInstallment.ts`'s moratory calculation — exact hook point depends on the confirmed answers above.

### Tests (mandatory)
- [ ] `UsuryRateService`: setting a new month's rate does not alter previous months' stored values; `getRateForMonth()` returns the correct historical value.
- [ ] Enforcement: a loan/concept exceeding the current ceiling is rejected or flagged per whatever was confirmed.
- [ ] `isStale`: false when the latest row's `effective_month` matches the current month; true when it's from a prior month (e.g. it's now August and the latest entered rate is still July's).

### Swagger
- [ ] New endpoints documented.

## Definition of done for this phase

- The current usury ceiling is visible and admin-updatable on a monthly cadence.
- Past months' rates remain intact and queryable after a new month's rate is entered.
- **Confirmed (client, publication-timing follow-up):** at the start of a new calendar month, if nobody has entered that month's certified rate yet, the admin sees a clear alert — not a fixed-day reminder, since the SFC's own publication date moves around.
- The confirmed enforcement rule (validation-time vs. read-time, retroactive vs. not) is implemented exactly as agreed — not guessed.
- All items in `docs/DEFINITION_OF_DONE.md` checklist pass.

## After this phase

Add a "Tasa de usura / Usury rate" entry to `docs/GLOSSARY.md` and a `usury_rates` table section to `docs/DATABASE.md`, including the confirmed retroactivity rule.

## Related documents

- `docs/phases/PHASE_14_INTEREST_CONCEPTS.md` — the concept model this phase's ceiling validates against
- `docs/DATABASE.md` — interest rate open question
