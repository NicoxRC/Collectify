# Phase 26 — Co-debtor as a Linked Client, Required Client Fields (Client)

## Goal

Two bundles requested by the client in the same meeting, merged into one phase. See `docs/phases/PHASE_26_CODEBTOR_CLIENT.md` for the backend half of both.

1. Replace the loan form's free-text co-debtor fields with a client picker (search-and-select an existing client, same pattern as any other client lookup in the app), matching the backend's move to a real relationship.
2. Mark `document_number` and at least one address field as required on `ClientForm`, matching the backend's new validation. Originally tracked as its own phase (formerly Phase 33 — Required Client Fields, Client); merged into this phase at the human's request — applies to `ClientForm` everywhere it's used, including the "crear cliente" flow launched from the co-debtor picker below.

## Scope

### Co-debtor
- [x] Loan creation/refinance form: replaced the co-debtor free-text inputs with a client search/select control (`LoanForm.tsx`/`RefinanceLoanForm.tsx`, mirroring the same search/select pattern already used for the loan's own `clientId`). If no matching client exists, a message with a "créalo aquí" link to `/clientes` (opened in a new tab) surfaces — matches the confirmed "primero hay que crear un cliente antes de ponerlo como codeudor" rule; the admin returns to this tab and searches again once created, rather than an in-flow auto-return.
- [x] Loan detail view: `LoanDetailPage.tsx` renders the co-debtor's name as a `Link` to `/clientes/:id`, sourced from `LoanDetail.coDebtorClient` (resolved server-side), not static text.
- [x] Refinance flow: `RefinanceLoanForm.tsx` pre-fills `coDebtorClient`/`coDebtorRelationship` from `oldLoanCoDebtorClient`/`oldLoanCoDebtorRelationship` (sourced from `LoanDetail.coDebtorClient`), fully editable — same carry-over-by-default semantics as before, just sourced from the relation instead of flat fields.
- [x] Client-side validation added beyond the original brief: a codeudor cannot be the same client as the loan's own `clientId` (checked against `oldLoanClientId` on refinance) — mirrors the backend's `assertCoDebtorIsValid` rule for immediate feedback instead of a round-trip 400.

### Required client fields
- [x] `ClientForm`: the cédula field (`documentNumber`) was **already** required with the same inline-validation pattern used for `dataProcessingConsent`/`documentType` — no change needed there.
- [x] Added: require at least one of `homeAddress`/`workAddress` — shared inline error message shown below both fields (mirrors the "Referencias" group-error pattern already in this form) if both are left empty on submit attempt; also mapped as a 400-response fallback in the submit catch block.
- [x] No change to the Excel import flow's UI — these requirements are enforced server-side per row and surfaced through the existing generic row-error display, same as any other `ClientsService.create()` rejection.

### Tests (per `docs/TESTING.md` conventions for this app)
- Frontend component/unit tests are explicitly out of scope project-wide (`docs/TESTING.md` "Out of scope (for now)": "Frontend component/unit tests") — the items originally listed here were not built as dedicated tests; verified instead via lint/build/manual review, consistent with how every other client-side phase in this project has been closed out.

## QoL follow-up (2026-08-30) — resolved

Three quality-of-life items requested after the initial co-debtor picker landed (see `docs/phases/PHASE_26_CODEBTOR_CLIENT.md` for the backend piece of the second item):

- [x] `coDebtorSearchResults` in `LoanForm.tsx`/`RefinanceLoanForm.tsx` filters out the loan's own client (`selectedClient?.id` / `oldLoanClientId`) so it never appears as a selectable codeudor.
- [x] Unchecking "tiene codeudor" during refinance now actually clears the co-debtor: `RefinanceLoanForm.tsx`'s submit payload sends explicit `coDebtorClientId: null, coDebtorRelationship: null` when the box is unchecked but the old loan had a co-debtor (previously the fields were just omitted, and the backend's `??` carry-over silently kept the old co-debtor).
- [x] `useClients()` (`useClients.ts`) gained an optional second `options` argument (`refetchOnWindowFocus`, `staleTime`), passed as `{ refetchOnWindowFocus: true, staleTime: 0 }` from both forms' codeudor search — so results refresh automatically when the admin comes back from the "créalo aquí" new-tab flow, without needing to retype the search. Uses conditional spread to avoid changing the app-wide defaults (`refetchOnWindowFocus: false`, `staleTime: 30s`) for any other `useClients()` call site.

## Definition of done for this phase

- [x] A co-debtor is attached to a loan by selecting an existing client, not typing their details.
- [x] The loan detail view links to the co-debtor's own client profile.
- [x] `ClientForm` cannot be submitted without a cédula and at least one address, in every flow that renders it.
- [x] Excel import is unaffected (frontend UI unchanged; server-side behavior is intentionally NOT exempt — see the api-side phase doc).
- [ ] All items in `docs/DEFINITION_OF_DONE.md` checklist pass — pending final lint/test/build verification across both apps.

## Related documents

- `docs/phases/PHASE_26_CODEBTOR_CLIENT.md` — backend half of both bundles this phase consumes
- `docs/phasesClient/PHASE_21_CLIENT_PROFILE.md` — the free-text co-debtor fields this phase replaces
