# Phase 7 — Dashboard and Reports (Client)

## Goal
The single screen answering "how is my portfolio doing right now" — the screen that replaces opening Excel. Mirrors `docs/phases/PHASE_7_DASHBOARD.md`.

## Scope

### Data layer
- [ ] `features/dashboard/dashboardApi.ts`, `useDashboard.ts` — hooks for summary, overdue-clients list, monthly report

### Pages and components
- [ ] `DashboardPage.tsx` — KPI cards from `GET /dashboard/summary`: total active clients, total overdue installments, total amount overdue, messages sent this week
- [ ] Sortable overdue-clients table from `GET /dashboard/overdue-clients` (sort by total overdue amount or max overdue days), showing name, total overdue amount, number of overdue installments, days of the most-overdue one
- [ ] Monthly report view from `GET /dashboard/monthly-report`, with a month/year picker
- [ ] Make this the landing page after login for both roles — per `docs/GLOSSARY.md`, `collector` has view access to overdue/mora status, so both roles benefit from this view; confirm with the human if `collector` should instead land somewhere narrower

## Definition of done for this phase

- KPI numbers displayed match the API's response exactly
- Sorting the overdue-clients table works correctly for both sort criteria
- The monthly report correctly scopes to the selected month/year
- All items in `docs/DEFINITION_OF_DONE.md` checklist pass

## Notes

This phase has no new business logic on the client either — it's a read-heavy view over Phases 3–6's data. If a KPI seems to require a decision not already covered by the `api`'s aggregation, flag it rather than inventing a client-side calculation.

## Related documents

- `docs/phases/PHASE_7_DASHBOARD.md` — the `api` counterpart and its aggregation endpoints
