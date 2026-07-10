# Phase 7 — Dashboard and Reports (Backend)

## Goal
Aggregate endpoints that power the owner's at-a-glance view of the business — the screen that replaces "open Excel and eyeball it."

## Scope

### Endpoints

- [ ] `GET /api/v1/dashboard/summary` — returns:
  - Total active clients
  - Total overdue installments (count)
  - Total amount overdue (sum of `totalDueForInstallment` across all currently-overdue installments — reuse Phase 4's calculation logic, don't reimplement it)
  - Messages sent this week (count from `message_logs`)
- [ ] `GET /api/v1/dashboard/overdue-clients` — paginated list of clients with at least one overdue installment, sortable by total overdue amount or by max overdue days, each row showing name, total overdue amount, number of overdue installments, days of the most-overdue one
- [ ] `GET /api/v1/dashboard/monthly-report?month=&year=` — for a given month: new loans disbursed, total payments received, messages sent

### Implementation notes
- These are read-heavy aggregate queries — use TypeORM's query builder where a repository method would be awkward, but keep the aggregation logic in the service layer, not in the controller.
- Reuse `InstallmentsService`'s overdue/interest calculation methods from Phase 4 rather than duplicating the formula here.

### Tests (mandatory)
- [ ] `DashboardService`: summary numbers are correct against seeded test data (e.g. exact overdue count and total amount for a known set of installments), overdue-clients list sorts correctly by both criteria, monthly report correctly scopes to the given month/year boundaries

### Swagger
- [ ] All endpoints documented

## Definition of done for this phase

- The summary endpoint's numbers can be manually verified against seeded test data and are exactly correct
- All items in `docs/DEFINITION_OF_DONE.md` checklist pass

## Notes

This phase has no complex new business logic — it's aggregation over what Phases 3–6 already built. If anything here feels like it needs a new business rule, it's a sign that rule should have been decided earlier — flag it to the human rather than inventing it here.
