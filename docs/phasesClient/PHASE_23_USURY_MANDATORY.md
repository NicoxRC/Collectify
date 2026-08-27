# Phase 23 — Usury Rate Becomes Mandatory and Self-Applied (Client)

## Goal

Reflect the new hard-block usury rule in the loan creation flow: block submission with a clear message when no current-month rate exists, and show the auto-filled, non-editable interest rate instead of an input field. See `docs/phases/PHASE_23_USURY_MANDATORY.md` for the backend rule this consumes.

## Scope

### Loan creation form
- [ ] Fetch `GET /usury-rates/current` before allowing the form to be submitted; if `isStale` (or no rate exists), show a blocking message directing the user to enter the current month's rate first, with a link/shortcut to the usury rate screen — don't let the form silently fail on submit.
- [ ] Replace whatever input currently lets the admin set a corriente/moratorio concept's percentage with a **read-only display** of the current usury rate, clearly labeled as auto-applied and non-editable.
- [ ] `POST /loans/preview-schedule` call already used for the live preview reflects the same auto-filled value — no client-side percentage entry to keep in sync.

### Remove the exceeded-ceiling warning UI
- [ ] Remove the "usury ceiling exceeded" warning banner and justification-note input from the loan creation/refinance flow — no longer reachable per the backend change.

### Tests (per `docs/TESTING.md` conventions for this app)
- [ ] Loan creation form blocks submission and shows the correct message when the current month's usury rate is missing/stale.
- [ ] The interest rate field renders as read-only, populated from `GET /usury-rates/current`.
- [ ] The exceeded-ceiling warning UI is no longer rendered anywhere in the loan flow.

## Definition of done for this phase

- A user cannot submit a new loan without the current month's usury rate on file, with a clear explanation why.
- The interest rate shown at loan creation is read-only and matches the current usury rate exactly.
- The old warning/justification UI is removed.
- All items in `docs/DEFINITION_OF_DONE.md` checklist pass.

## Related documents

- `docs/phases/PHASE_23_USURY_MANDATORY.md` — backend rule this phase consumes
- `docs/phasesClient/PHASE_15_USURY_RATE.md` — the warning UI this phase removes
