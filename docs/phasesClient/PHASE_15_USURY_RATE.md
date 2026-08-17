# Phase 15 — Usury Rate Ceiling (Tasa de Usura Global) (Client)

## Goal

Give an admin a simple place to view and update the monthly usury ceiling, and warn (not block — the `api` remains the source of truth) when entered loan terms would exceed it. Mirrors `docs/phases/PHASE_15_USURY_RATE.md`.

## Required reading before starting

`docs/phases/PHASE_15_USURY_RATE.md` (the `api` counterpart, including its open questions and domain research on how Colombia's usury rate works).

## Scope

### Data layer
- [x] `usuryRatesApi.ts` — `getCurrent()`, `getHistory()`, `setRate(input)`.
- [x] `useUsuryRates.ts` hooks (TanStack Query) — `useCurrentUsuryRate()`, `useUsuryRateHistory()`, `useSetUsuryRate()`. A single `['usuryRates', 'current']` query key is shared by the settings page and the stale-rate banner, so entering a new month's rate anywhere clears the banner everywhere.

### Settings page
- [x] New admin-only settings screen at `/tasa-de-usura` (no dedicated `/configuracion` area exists yet, so this got its own route rather than a sub-section of one) — view the current rate + `isStale` alert, a form to enter a new month's value (`<input type="month">` + rate), and a history table below. No edit/deactivate actions: rates are append-only history, confirmed non-retroactive with the human.

### Stale-rate alert (confirmed with the client — publication timing follow-up)
- [x] `StaleUsuryRateBanner.tsx`: when `GET /usury-rates/current` returns `isStale: true`, shows a persistent, hard-to-miss banner with a link to `/tasa-de-usura`. Rendered on `LoansListPage.tsx` (admin only, matching the endpoint's own `@Roles(UserRole.Admin)`) — not a dismiss-once-and-forget banner, it keeps showing every session until a current-month rate is entered, since the SFC's publication date moves around and there's no fixed day to remind on instead.

### Loan creation
- [x] `LoanForm.tsx`/`RefinanceLoanForm.tsx`: `POST /loans/preview-schedule` now returns `{ installments, usuryWarning }` — both forms show an inline warning banner (rate exceeded vs. ceiling, both numbers shown) when `usuryWarning` is non-null, plus an optional "Justificación de la tasa de usura" textarea wired to `usuryJustification` on submit. Client-side pre-check only, the `api` remains the enforcement authority — the same warning is recomputed and snapshotted server-side regardless of what the client sends.

## Definition of done for this phase

- [x] An admin can view and update the usury rate monthly without needing direct database access.
- [x] **Confirmed (client, publication-timing follow-up):** an admin who hasn't entered the current month's rate sees a clear, persistent alert as soon as a new month starts — not tied to a specific day.
- [x] The loan creation form warns before submission if terms would exceed the current ceiling.
- [x] All items in `docs/DEFINITION_OF_DONE.md` checklist pass.

## Related documents

- `docs/phases/PHASE_15_USURY_RATE.md` — the `api` counterpart
