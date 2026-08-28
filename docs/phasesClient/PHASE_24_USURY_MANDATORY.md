# Phase 24 — Usury Rate Becomes Mandatory and Self-Applied (Client)

## Goal

Reflect the new hard-block usury rule in the loan creation flow: block submission with a clear message when no current-month rate exists, and show the auto-filled, non-editable interest rate instead of an input field. See `docs/phases/PHASE_24_USURY_MANDATORY.md` for the backend rule this consumes.

## Scope

### Loan creation form
- [x] `LoanForm`/`RefinanceLoanForm`/`LoanQuotePage` all fetch `GET /usury-rates/current` via `useCurrentUsuryRate()`; when missing or `isStale`, `StaleUsuryRateBanner` shows a blocking message with a link to `/tasa-de-usura` (admin only — a collector can't act on that link, so it's hidden for them; they see the message without it) and the preview/submit buttons are disabled (`hasUsableUsuryRate`).
- [x] Every percentage-type concept row's value input (corriente and moratorio, in both forms and the standalone Cotizador) is now `disabled`, pre-filled with the current rate, with a `title` tooltip explaining it's auto-applied. Fixed-amount rows are unaffected.
- [x] `POST /loans/preview-schedule` reflects the same auto-filled value — no client-side percentage entry to keep in sync, and preview itself is disabled/blocked the same way as submit when there's no usable rate.
- [x] `StaleUsuryRateBanner`'s visibility was also widened from admin-only to "can create a loan" (`LoansListPage`) / open (Cotizador, already open to everyone) — a Phase-23-granted collector needs this warning too, now that a missing rate is a hard block.

### Remove the exceeded-ceiling warning UI
- [x] Removed the "usury ceiling exceeded" warning banner and justification-note field/state from `LoanForm`, `RefinanceLoanForm`, and `LoanQuotePage` — no longer reachable per the backend change.

### Tests
- No component-level tests added — same rationale as Phase 23's frontend (`docs/phasesClient/PHASE_23_DYNAMIC_CHARGES.md` "Tests"): `docs/TESTING.md` scopes required testing to the API's service layer, and no React component test exists in this codebase to follow as precedent. Verified via manual browser testing (Playwright + headless Chromium): a percentage concept row renders `disabled` and pre-filled with the real current rate; removing the current-month rate row shows the blocking banner and disables the submit button; restoring it re-enables the form — screenshotted at each step.

## Definition of done for this phase

- [x] A user cannot submit a new loan without the current month's usury rate on file, with a clear explanation why.
- [x] The interest rate shown at loan creation is read-only and matches the current usury rate exactly.
- [x] The old warning/justification UI is removed.
- [x] All items in `docs/DEFINITION_OF_DONE.md` checklist pass.

## Related documents

- `docs/phases/PHASE_24_USURY_MANDATORY.md` — backend rule this phase consumes
- `docs/phasesClient/PHASE_15_USURY_RATE.md` — the warning UI this phase removes
