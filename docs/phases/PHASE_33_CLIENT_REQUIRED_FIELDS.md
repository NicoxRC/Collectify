# Phase 33 — Required Client Fields

## Goal

Make `document_number` (cédula) and at least one address field required when a client is created interactively — today both are nullable/optional at the application level, unlike `dataProcessingConsent`/`documentType`, which Phase 21 already enforces as required on this same flow.

## Resolved — confirmed directly with the human (reunión 2026-08-25)

- **Cédula obligatorio.**
- **Direcciones obligatorias, mínimo una** — at least one of `home_address`/`work_address` must be present; not both required.

## Required reading before starting

`docs/phases/PHASE_21_CLIENT_PROFILE.md` (the existing required-field precedent — `dataProcessingConsent`/`documentType` — this phase follows the same pattern), `docs/DATABASE.md` (`clients`).

## Scope

### Service and API
- [ ] `ClientsService.create()`: reject (matching the existing pattern used for `dataProcessingConsent`/`documentType`) when `documentNumber` is missing/empty, or when both `homeAddress` and `workAddress` are missing/empty — application-level validation, not a DB `NOT NULL` constraint, same reasoning as Phase 21's existing exemption below.
- [ ] **Excel-imported clients remain exempt**, matching Phase 21's precedent (`docs/phases/PHASE_8_EXCEL_IMPORT.md` unaffected) — these two new requirements apply only to the interactive `POST /clients` flow.

### Tests (mandatory)
- [ ] `POST /clients` rejects a request missing `documentNumber`.
- [ ] `POST /clients` rejects a request with both address fields empty, and accepts one with at least one populated.
- [ ] Excel import is unaffected by either new rule.

### Swagger
- [ ] `POST /clients` DTO/description updated to note both new requirements.

## Definition of done for this phase

- A client cannot be created interactively without a cédula and at least one address.
- Excel-imported clients remain exempt, matching the existing consent/document-type precedent.
- All items in `docs/DEFINITION_OF_DONE.md` checklist pass.

## After this phase

Update `docs/DATABASE.md`'s `clients` table notes and `docs/phases/PHASE_21_CLIENT_PROFILE.md`'s "Mandatory vs. optional" decision log to list these two additional required-at-creation fields.

## Related documents

- `docs/phases/PHASE_21_CLIENT_PROFILE.md` — the required-field precedent this phase follows
- `docs/phases/PHASE_8_EXCEL_IMPORT.md` — confirmed unaffected
- `docs/DATABASE.md`
