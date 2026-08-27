# Phase 26 — Co-debtor as a Linked Client, Required Client Fields (Client)

## Goal

Two bundles requested by the client in the same meeting, merged into one phase. See `docs/phases/PHASE_26_CODEBTOR_CLIENT.md` for the backend half of both.

1. Replace the loan form's free-text co-debtor fields with a client picker (search-and-select an existing client, same pattern as any other client lookup in the app), matching the backend's move to a real relationship.
2. Mark `document_number` and at least one address field as required on `ClientForm`, matching the backend's new validation. Originally tracked as its own phase (formerly Phase 33 — Required Client Fields, Client); merged into this phase at the human's request — applies to `ClientForm` everywhere it's used, including the "crear cliente" flow launched from the co-debtor picker below.

## Scope

### Co-debtor
- [ ] Loan creation/refinance form: replace the co-debtor free-text inputs with a client search/select control. If no matching client exists, surface a clear path to "crear cliente" first (new tab/flow), then return and select them — matches the confirmed "primero hay que crear un cliente antes de ponerlo como codeudor" rule.
- [ ] Loan detail view: render the co-debtor as a link/summary to their client profile, not static text.
- [ ] Refinance flow: pre-fill the carried-over co-debtor from the old loan, same as today, sourced from the relation instead of flat fields.

### Required client fields
- [ ] `ClientForm`: mark the cédula field as required with the same inline-validation pattern already used for `dataProcessingConsent`/`documentType` (Phase 21).
- [ ] Require at least one of `homeAddress`/`workAddress` — clear inline message if both are left empty on submit attempt.
- [ ] No change to the Excel import flow — these requirements are interactive-creation only.

### Tests (per `docs/TESTING.md` conventions for this app)
- [ ] Co-debtor client search/select works and submits `coDebtorClientId` correctly.
- [ ] Loan detail correctly links to the co-debtor's client profile.
- [ ] Refinance form pre-fills the carried-over co-debtor.
- [ ] Form blocks submission without a cédula.
- [ ] Form blocks submission with both address fields empty, and allows submission with at least one filled.

## Definition of done for this phase

- A co-debtor is attached to a loan by selecting an existing client, not typing their details.
- The loan detail view links to the co-debtor's own client profile.
- `ClientForm` cannot be submitted without a cédula and at least one address, in every flow that renders it.
- Excel import is unaffected.
- All items in `docs/DEFINITION_OF_DONE.md` checklist pass.

## Related documents

- `docs/phases/PHASE_26_CODEBTOR_CLIENT.md` — backend half of both bundles this phase consumes
- `docs/phasesClient/PHASE_21_CLIENT_PROFILE.md` — the free-text co-debtor fields this phase replaces
