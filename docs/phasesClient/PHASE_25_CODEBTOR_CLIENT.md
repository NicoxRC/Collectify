# Phase 25 — Co-debtor as a Linked Client (Client)

## Goal

Replace the loan form's free-text co-debtor fields with a client picker (search-and-select an existing client, same pattern as any other client lookup in the app), matching the backend's move to a real relationship. See `docs/phases/PHASE_25_CODEBTOR_CLIENT.md` for the backend model this consumes.

## Scope

- [ ] Loan creation/refinance form: replace the co-debtor free-text inputs with a client search/select control. If no matching client exists, surface a clear path to "crear cliente" first (new tab/flow), then return and select them — matches the confirmed "primero hay que crear un cliente antes de ponerlo como codeudor" rule.
- [ ] Loan detail view: render the co-debtor as a link/summary to their client profile, not static text.
- [ ] Refinance flow: pre-fill the carried-over co-debtor from the old loan, same as today, sourced from the relation instead of flat fields.

### Tests (per `docs/TESTING.md` conventions for this app)
- [ ] Co-debtor client search/select works and submits `coDebtorClientId` correctly.
- [ ] Loan detail correctly links to the co-debtor's client profile.
- [ ] Refinance form pre-fills the carried-over co-debtor.

## Definition of done for this phase

- A co-debtor is attached to a loan by selecting an existing client, not typing their details.
- The loan detail view links to the co-debtor's own client profile.
- All items in `docs/DEFINITION_OF_DONE.md` checklist pass.

## Related documents

- `docs/phases/PHASE_25_CODEBTOR_CLIENT.md` — backend model this phase consumes
- `docs/phasesClient/PHASE_21_CLIENT_PROFILE.md` — the free-text co-debtor fields this phase replaces
