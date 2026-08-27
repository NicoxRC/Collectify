# Phase 32 — Required Client Fields (Client)

## Goal

Mark `document_number` and at least one address field as required on `ClientForm`, matching the backend's new validation. See `docs/phases/PHASE_32_CLIENT_REQUIRED_FIELDS.md`.

## Scope

- [ ] `ClientForm`: mark the cédula field as required with the same inline-validation pattern already used for `dataProcessingConsent`/`documentType` (Phase 21).
- [ ] Require at least one of `homeAddress`/`workAddress` — clear inline message if both are left empty on submit attempt.
- [ ] No change to the Excel import flow — these requirements are interactive-creation only.

### Tests (per `docs/TESTING.md` conventions for this app)
- [ ] Form blocks submission without a cédula.
- [ ] Form blocks submission with both address fields empty, and allows submission with at least one filled.

## Definition of done for this phase

- `ClientForm` cannot be submitted without a cédula and at least one address.
- Excel import is unaffected.
- All items in `docs/DEFINITION_OF_DONE.md` checklist pass.

## Related documents

- `docs/phases/PHASE_32_CLIENT_REQUIRED_FIELDS.md` — backend rule this phase consumes
