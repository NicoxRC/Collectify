# Phase 15 — Usury Rate Ceiling (Tasa de Usura Global) (Client)

## Goal

Give an admin a simple place to view and update the monthly usury ceiling, and warn (not block — the `api` remains the source of truth) when entered loan terms would exceed it. Mirrors `docs/phases/PHASE_15_USURY_RATE.md`.

## Required reading before starting

`docs/phases/PHASE_15_USURY_RATE.md` (the `api` counterpart, including its open questions and domain research on how Colombia's usury rate works).

## Scope

### Data layer
- [ ] `usuryRatesApi.ts` — `getCurrent()`, `getHistory()`, `setRate(dto)`.
- [ ] `useUsuryRate.ts` hooks (TanStack Query).

### Settings page
- [ ] New small admin-only settings area (route `/configuracion` or similar, `RequireRole allowedRoles={['admin']}`) — form to view the current rate and enter the new month's value, with a simple history table below (reuse a stripped-down `MessageLogsPage.tsx`-style table shell).

### Stale-rate alert (confirmed with the client — publication timing follow-up)
- [ ] When `GET /usury-rates/current` returns `isStale: true`, show a persistent, hard-to-miss banner (not just on the settings page — anywhere an admin would otherwise start creating a loan, e.g. `LoansListPage.tsx`/`LoanForm.tsx`, so it's seen before it matters) telling the admin the usury rate for the current month hasn't been entered yet, with a direct link to the settings page above. Not a dismiss-once-and-forget banner — it should keep showing every session until a current-month rate is entered, since the SFC's publication date moves around and there's no fixed day to remind on instead (see the `api` doc's domain research).

### Loan creation
- [ ] `LoanForm.tsx`: informational warning banner if the entered interest concepts (Phase 14) would exceed the current usury ceiling — client-side pre-check only, the `api` remains the enforcement authority.

## Definition of done for this phase

- An admin can view and update the usury rate monthly without needing direct database access.
- **Confirmed (client, publication-timing follow-up):** an admin who hasn't entered the current month's rate sees a clear, persistent alert as soon as a new month starts — not tied to a specific day.
- The loan creation form warns before submission if terms would exceed the current ceiling.
- All items in `docs/DEFINITION_OF_DONE.md` checklist pass.

## Related documents

- `docs/phases/PHASE_15_USURY_RATE.md` — the `api` counterpart
