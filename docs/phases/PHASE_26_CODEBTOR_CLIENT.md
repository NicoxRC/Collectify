# Phase 26 — Co-debtor as a Linked Client

## Goal

Replace `Loan`'s flat `co_debtor_*` columns (Phase 21) with a proper relationship to an existing `Client` record — a co-debtor is, functionally, another client of the business, and should be searchable/reusable as one instead of re-typed by hand on every loan.

## Resolved — confirmed directly with the human (reunión 2026-08-25)

- **Codeudor = another client:** "codeudor que sea como crear otro cliente porque codeudor al final es otro cliente."
- **Client must exist first:** "primero hay que crear un cliente antes de ponerlo como codeudor" — a loan's co-debtor is picked from existing clients (create-then-attach), not entered inline as free text at loan creation the way Phase 21 built it.

## Open questions — confirm before implementing

- [ ] **What happens to loans that already have `co_debtor_*` data filled in under the Phase 21 model?** Two realistic paths: (a) a one-time data migration that creates a `Client` record from each populated set of `co_debtor_*` columns and links it, or (b) leave existing loans on the old flat columns (kept, read-only) and only apply the new linked model going forward. Given this project's migration policy of never silently discarding real data, do not guess between these — confirm directly with the human, since (a) risks creating duplicate/junk `Client` records if a real client already exists under the same document number.
- [ ] **Can the same client be a co-debtor on more than one loan, or even be both a primary debtor and a co-debtor at once?** Not addressed by the resolved answers above; confirm before deciding whether the relationship needs any uniqueness constraint.
- [ ] Does a co-debtor client need any of Phase 21's KYC fields to be complete before being attachable, or is any existing client eligible regardless of profile completeness?

## Required reading before starting

`docs/phases/PHASE_21_CLIENT_PROFILE.md` (the `co_debtor_*` columns this phase replaces), `docs/DATABASE.md` (`loans`, `clients`), `docs/GLOSSARY.md` ("Codeudor / Co-debtor").

## Scope (once the open questions above are confirmed)

### Entities and migrations
- [ ] `Loan.coDebtorClientId` (UUID, nullable) — FK → `clients.id`. `ON DELETE` behavior needs the same confirmation as any other client-deletion cascade question in this project (soft-delete only, per `docs/DATABASE.md` conventions — a co-debtor client being soft-deleted shouldn't hard-break existing loan references).
- [ ] Migration `AddCoDebtorClientIdToLoans`.
- [ ] Migration/decision to retire `co_debtor_full_name`, `co_debtor_document_type`, `co_debtor_document_number`, `co_debtor_phone_number`, `co_debtor_address`, `co_debtor_relationship`, `co_debtor_id_document_url` — kept or backfilled per the open data-migration question above; do not drop columns with real data before that's resolved.
- [ ] `co_debtor_relationship` (relación con el deudor principal) has no natural home on a `Client` record — confirm whether it moves to a per-loan free-text column that survives this refactor (e.g. `Loan.coDebtorRelationship`, kept standalone) or is dropped.

### Service and API
- [ ] `POST /loans` / `POST /loans/:id/refinance`: accept `coDebtorClientId` instead of the flat co-debtor fields; validate the referenced client exists.
- [ ] `LoansService.refinance()`'s existing "carry the old loan's co-debtor over by default" behavior (`docs/DATABASE.md` "On the co-debtor and refinancing") is preserved, now carrying `coDebtorClientId` instead of the flat fields.
- [ ] Loan detail response includes the co-debtor's client summary (name, document number, phone) resolved via the relation, not snapshotted flat columns.

### Tests (mandatory)
- [ ] A loan can be created with an existing client as co-debtor; the relation resolves correctly on read.
- [ ] A loan can be created/refinanced with no co-debtor at all (unaffected, matching Phase 21's "at most one, optional" rule).
- [ ] Refinancing carries the co-debtor relation forward by default, same as the flat-column behavior it replaces.
- [ ] Whatever the confirmed answer to the data-migration open question above turns out to be, covered by a dedicated test/migration verification.

### Swagger
- [ ] `POST /loans`/`POST /loans/:id/refinance` DTOs and loan detail response updated.

## Definition of done for this phase

- A loan's co-debtor is an existing `Client`, selected rather than typed.
- Existing loans' co-debtor data is handled exactly per the confirmed answer to the data-migration open question — not silently dropped.
- All items in `docs/DEFINITION_OF_DONE.md` checklist pass.

## After this phase

Update `docs/DATABASE.md`'s `loans` table section and `docs/GLOSSARY.md`'s "Codeudor / Co-debtor" entry to describe the linked-client model, replacing the Phase 21 flat-column description.

## Related documents

- `docs/phases/PHASE_21_CLIENT_PROFILE.md` — the flat co-debtor columns this phase replaces
- `docs/DATABASE.md`, `docs/GLOSSARY.md`
