# Phase 10 — Client Capacity (Cupo) and Reactivation

## Goal

Give each client a maximum credit exposure ("cupo") that the system enforces automatically when a new loan is created, and let admins bring back a soft-deleted client instead of leaving them as a permanent dead end.

## Before starting this phase — stop and confirm with the human

Two business rules are not defined anywhere in the current code or docs and must not be guessed:

1. **What counts toward "cupo usado" (credit used)?** Candidates: only outstanding principal across the client's active loans; principal plus interest accrued to date; principal plus all configured interest concepts (once Phase 14 exists). Get this wrong and a client could be blocked who shouldn't be, or approved for a loan that pushes them past their real limit.
2. **Is the mora &gt; 30 days block per-installment or client-aggregate?** I.e. does *any single* installment overdue more than 30 days block new loans for that client, or does it need to be the client's *oldest* overdue installment, or a sum/average across installments?

**Do not pick one and build it — ask the human which behavior matches how the business actually works before writing this phase's code.**

## Required reading before starting

`docs/GLOSSARY.md`, `docs/DATABASE.md` (client and loan sections), `docs/phases/PHASE_3_CLIENTS.md` (existing soft-delete behavior this phase extends).

## Scope (once the above is confirmed)

### Entities and migrations
- [ ] `Client`: add `credit_limit` (`DECIMAL(12,2)`, nullable — unset means no cupo enforced, same "absence of a value means the rule doesn't apply" convention used elsewhere in this project).
- [ ] Migration `AddCreditLimitToClients`.

### Cupo calculation
- [ ] `ClientsService.getCreditUsage(clientId)` — returns `{ creditLimit, creditUsed, creditAvailable }`, computed on read from the client's active loans per whatever base was confirmed above — not a stored/denormalized column, same pattern as `enrichInstallment()`'s `overdueDays`/`interest`/`totalDue`.
- [ ] `ClientsService.hasMoraBlock(clientId)` — returns whether the client has any (or whatever unit was confirmed above) installment overdue more than 30 days.
- [ ] `GET /api/v1/clients/:id` response includes `creditUsed`, `creditAvailable`, `isMoraBlocked`.

### Loan creation guard
- [ ] `LoansService.create()`: reject with a clear error if the new loan's principal would exceed the client's available cupo.
- [ ] `LoansService.create()`: reject with a clear error if the client is mora-blocked, even if cupo is available — this must be checked and reported as a distinct reason from "cupo exceeded" so the admin (and the client, if told) understands why.

### Reactivation
- [ ] `ClientsService.reactivate(id)` — restores a soft-deleted client, mirroring `UsersService.reactivate()` exactly (`restore()` on the soft-deleted row via TypeORM).
- [ ] `PATCH /api/v1/clients/:id/reactivate` — admin only.

### Tests (mandatory)
- [ ] `getCreditUsage`/`hasMoraBlock`: correct for a client with no loans, one active loan, multiple active loans, a refinanced loan (should its old, closed-out balance count? — confirm as part of the "Before starting" question above).
- [ ] `LoansService.create()`: rejects when over cupo, rejects when mora-blocked, allows when within cupo and not mora-blocked.
- [ ] `ClientsService.reactivate()`: restores a soft-deleted client; reactivating an already-active client is a no-op or clear error (pick one, document it).

### Swagger
- [ ] All new/changed endpoints documented, including the two distinct rejection reasons on loan creation.

## Definition of done for this phase

- A client's available cupo is visible and enforced at loan creation time.
- A client with any installment overdue more than 30 days cannot get a new loan, regardless of remaining cupo.
- A soft-deleted client can be reactivated and becomes fully usable again (visible in `GET /clients/:id`, eligible for new loans if within cupo).
- The confirmed rules from "Before starting this phase" are implemented exactly as agreed — not guessed.
- All items in `docs/DEFINITION_OF_DONE.md` checklist pass.

## After this phase

Update `docs/DATABASE.md` (`clients` table, new `credit_limit` column and the confirmed cupo/mora-block rules) and `docs/GLOSSARY.md` (add a "Cupo" entry) with the confirmed behavior.

## Related documents

- `docs/phases/PHASE_3_CLIENTS.md` — existing client CRUD and soft-delete this phase extends
- `docs/phases/PHASE_4_LOANS_INSTALLMENTS.md` — loan creation flow this phase adds a guard to
- `docs/DATABASE.md` — client and loan schema
- `docs/GLOSSARY.md` — business vocabulary
