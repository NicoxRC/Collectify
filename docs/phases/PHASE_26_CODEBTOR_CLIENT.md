# Phase 26 — Co-debtor as a Linked Client, Required Client Fields

## Goal

Two bundles requested by the client in the same meeting, merged into one phase — both touch the client-creation flow:

1. Replace `Loan`'s flat `co_debtor_*` columns (Phase 21) with a proper relationship to an existing `Client` record — a co-debtor is, functionally, another client of the business, and should be searchable/reusable as one instead of re-typed by hand on every loan.
2. Make `document_number` (cédula) and at least one address field required when a client is created interactively — today both are nullable/optional at the application level, unlike `dataProcessingConsent`/`documentType`, which Phase 21 already enforces as required on this same flow. Originally tracked as its own phase (formerly Phase 33 — Required Client Fields); merged into this phase at the human's request. Independent of the co-debtor work above — this applies to every interactively-created client, including one being created specifically to attach as a co-debtor.

## Resolved — confirmed directly with the human (reunión 2026-08-25)

Co-debtor:
- **Codeudor = another client:** "codeudor que sea como crear otro cliente porque codeudor al final es otro cliente."
- **Client must exist first:** "primero hay que crear un cliente antes de ponerlo como codeudor" — a loan's co-debtor is picked from existing clients (create-then-attach), not entered inline as free text at loan creation the way Phase 21 built it.

Required client fields:
- **Cédula obligatorio.**
- **Direcciones obligatorias, mínimo una** — at least one of `home_address`/`work_address` must be present; not both required.

## Open questions — confirm before implementing

These apply only to the co-debtor half of this phase — the required-fields half has no open questions and can be built regardless of how these resolve.

- [ ] **What happens to loans that already have `co_debtor_*` data filled in under the Phase 21 model?** Two realistic paths: (a) a one-time data migration that creates a `Client` record from each populated set of `co_debtor_*` columns and links it, or (b) leave existing loans on the old flat columns (kept, read-only) and only apply the new linked model going forward. Given this project's migration policy of never silently discarding real data, do not guess between these — confirm directly with the human, since (a) risks creating duplicate/junk `Client` records if a real client already exists under the same document number.
- [ ] **Can the same client be a co-debtor on more than one loan, or even be both a primary debtor and a co-debtor at once?** Not addressed by the resolved answers above; confirm before deciding whether the relationship needs any uniqueness constraint.
- [ ] Does a co-debtor client need any of Phase 21's KYC fields to be complete before being attachable, or is any existing client eligible regardless of profile completeness?

## Required reading before starting

`docs/phases/PHASE_21_CLIENT_PROFILE.md` (the `co_debtor_*` columns this phase replaces, and the existing required-field precedent — `dataProcessingConsent`/`documentType` — the required-fields half of this phase follows), `docs/DATABASE.md` (`loans`, `clients`), `docs/GLOSSARY.md` ("Codeudor / Co-debtor").

## Scope

### Co-debtor (once the open questions above are confirmed)

#### Entities and migrations
- [ ] `Loan.coDebtorClientId` (UUID, nullable) — FK → `clients.id`. `ON DELETE` behavior needs the same confirmation as any other client-deletion cascade question in this project (soft-delete only, per `docs/DATABASE.md` conventions — a co-debtor client being soft-deleted shouldn't hard-break existing loan references).
- [ ] Migration `AddCoDebtorClientIdToLoans`.
- [ ] Migration/decision to retire `co_debtor_full_name`, `co_debtor_document_type`, `co_debtor_document_number`, `co_debtor_phone_number`, `co_debtor_address`, `co_debtor_relationship`, `co_debtor_id_document_url` — kept or backfilled per the open data-migration question above; do not drop columns with real data before that's resolved.
- [ ] `co_debtor_relationship` (relación con el deudor principal) has no natural home on a `Client` record — confirm whether it moves to a per-loan free-text column that survives this refactor (e.g. `Loan.coDebtorRelationship`, kept standalone) or is dropped.

#### Service and API
- [ ] `POST /loans` / `POST /loans/:id/refinance`: accept `coDebtorClientId` instead of the flat co-debtor fields; validate the referenced client exists.
- [ ] `LoansService.refinance()`'s existing "carry the old loan's co-debtor over by default" behavior (`docs/DATABASE.md` "On the co-debtor and refinancing") is preserved, now carrying `coDebtorClientId` instead of the flat fields.
- [ ] Loan detail response includes the co-debtor's client summary (name, document number, phone) resolved via the relation, not snapshotted flat columns.

#### Tests (mandatory)
- [ ] A loan can be created with an existing client as co-debtor; the relation resolves correctly on read.
- [ ] A loan can be created/refinanced with no co-debtor at all (unaffected, matching Phase 21's "at most one, optional" rule).
- [ ] Refinancing carries the co-debtor relation forward by default, same as the flat-column behavior it replaces.
- [ ] Whatever the confirmed answer to the data-migration open question above turns out to be, covered by a dedicated test/migration verification.

#### Swagger
- [ ] `POST /loans`/`POST /loans/:id/refinance` DTOs and loan detail response updated.

### Required client fields (not blocked by the open questions above)

#### Service and API
- [ ] `ClientsService.create()`: reject (matching the existing pattern used for `dataProcessingConsent`/`documentType`) when `documentNumber` is missing/empty, or when both `homeAddress` and `workAddress` are missing/empty — application-level validation, not a DB `NOT NULL` constraint, same reasoning as Phase 21's existing exemption below. Applies to every interactive `POST /clients` call, including one made to create a co-debtor.
- [ ] **Excel-imported clients remain exempt**, matching Phase 21's precedent (`docs/phases/PHASE_8_EXCEL_IMPORT.md` unaffected) — these two new requirements apply only to the interactive `POST /clients` flow.

#### Tests (mandatory)
- [ ] `POST /clients` rejects a request missing `documentNumber`.
- [ ] `POST /clients` rejects a request with both address fields empty, and accepts one with at least one populated.
- [ ] Excel import is unaffected by either new rule.

#### Swagger
- [ ] `POST /clients` DTO/description updated to note both new requirements.

## Definition of done for this phase

- A loan's co-debtor is an existing `Client`, selected rather than typed.
- Existing loans' co-debtor data is handled exactly per the confirmed answer to the data-migration open question — not silently dropped.
- A client cannot be created interactively without a cédula and at least one address, including when created to serve as a co-debtor.
- Excel-imported clients remain exempt from the two new required-field rules.
- All items in `docs/DEFINITION_OF_DONE.md` checklist pass.

## After this phase

Update `docs/DATABASE.md`'s `loans` and `clients` table sections, `docs/GLOSSARY.md`'s "Codeudor / Co-debtor" entry to describe the linked-client model (replacing the Phase 21 flat-column description), and `docs/phases/PHASE_21_CLIENT_PROFILE.md`'s "Mandatory vs. optional" decision log to list the two additional required-at-creation fields.

## Related documents

- `docs/phases/PHASE_21_CLIENT_PROFILE.md` — the flat co-debtor columns this phase replaces, and the required-field precedent the second half of this phase follows
- `docs/phases/PHASE_8_EXCEL_IMPORT.md` — confirmed unaffected by the required-fields half
- `docs/phasesClient/PHASE_26_CODEBTOR_CLIENT.md` — the client-side half of this bundle
- `docs/DATABASE.md`, `docs/GLOSSARY.md`
