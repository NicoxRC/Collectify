# Phase 28 — Multi-Installment Payments (Client)

## Goal

Let a collector select several pending installments on a loan and register their payments in one flow, uploading more than one receipt photo per installment. See `docs/phases/PHASE_28_MULTI_INSTALLMENT_PAYMENT.md` for the backend model this consumes.

## Resolved — confirmed directly with the human (2026-08-28)

- **Amount entry in a batch:** one amount typed individually per selected installment, not a single total auto-split.
- **Partial vs. full in a batch:** the batch requires **full** payment of every selected installment — partial payment stays on `RegisterPaymentDialog`'s existing single-installment flow.

## Scope

- [x] Loan detail's installment list: allow selecting multiple pending installments (checkboxes) and opening one payment dialog for the batch. The sequential-payment rule referenced in `docs/phasesClient/PHASE_32_UI_FIXES.md` is **Phase 32's own not-yet-built scope** (today ANY pending installment's "Pagar" button is enabled, sequential order isn't enforced anywhere yet) — per `CLAUDE.md`'s "never build functionality from a later phase before the current one is done," this phase's checkbox selection matches that same current (unrestricted) behavior rather than pre-emptively restricting selection order. Revisit together with Phase 32.
- [x] `RegisterPaymentDialog`: supports uploading multiple receipt images for a single installment's payment — reuses `apps/client/src/lib/imageUpload.ts`'s `uploadPaymentReceipt`, called once per file, sequentially, so a failure identifies which file failed before anything submits.
- [x] New `BulkRegisterPaymentDialog`: one amount entered individually per selected installment (pre-filled to that installment's `totalDue`, client-side validated against the full-payment rule before submit), shared date/observación for the batch, its own optional multi-image picker per installment.

### Tests (per `docs/TESTING.md` conventions for this app)
Frontend component/unit tests are explicitly out of scope per `docs/TESTING.md` ("Out of scope (for now)"). Verified manually instead: multiple installments selected and paid in one submission; multiple receipt images attached to one payment and all render afterward in the payment history; a short amount is rejected client-side before submit. See the backend's own PR description for the end-to-end (real Postgres) verification, since the client's request/response shapes were exercised together with it.

## Definition of done for this phase

- [x] A collector can pay several cuotas in one action from the panel.
- [x] A payment's history view shows every attached receipt image, not just one.
- [x] All items in `docs/DEFINITION_OF_DONE.md` checklist pass.

## Related documents

- `docs/phases/PHASE_28_MULTI_INSTALLMENT_PAYMENT.md` — backend model this phase consumes
- `docs/phasesClient/PHASE_12_PAYMENT_ATTACHMENTS.md` — the single-image upload flow this phase extends
