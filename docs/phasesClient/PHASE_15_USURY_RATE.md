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

### Loan creation
- [ ] `LoanForm.tsx`: informational warning banner if the entered interest concepts (Phase 14) would exceed the current usury ceiling — client-side pre-check only, the `api` remains the enforcement authority.

## Definition of done for this phase

- An admin can view and update the usury rate monthly without needing direct database access.
- The loan creation form warns before submission if terms would exceed the current ceiling.
- All items in `docs/DEFINITION_OF_DONE.md` checklist pass.

## Related documents

- `docs/phases/PHASE_15_USURY_RATE.md` — the `api` counterpart
