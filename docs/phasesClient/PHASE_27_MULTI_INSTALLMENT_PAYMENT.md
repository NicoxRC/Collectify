# Phase 27 — Multi-Installment Payments (Client)

## Goal

Let a collector select several pending installments on a loan and register their payments in one flow, uploading more than one receipt photo per installment. See `docs/phases/PHASE_27_MULTI_INSTALLMENT_PAYMENT.md` for the backend model this consumes.

## Scope

- [ ] Loan detail's installment list: allow selecting multiple pending installments (checkboxes, respecting the sequential-payment rule from `docs/phasesClient/PHASE_31_UI_FIXES.md`) and opening one payment dialog for the batch.
- [ ] `RegisterPaymentDialog` (or equivalent): support uploading multiple receipt images for a single installment's payment, not just one — reuse `apps/client/src/lib/imageUpload.ts` for each file.
- [ ] Batch payment dialog shape follows whatever the backend's open question (amount split vs. per-installment entry) resolves to — do not build ahead of that confirmation.

### Tests (per `docs/TESTING.md` conventions for this app)
- [ ] Multiple installments can be selected and paid in one submission.
- [ ] Multiple receipt images can be attached to one payment and all render afterward in the payment history.

## Definition of done for this phase

- A collector can pay several cuotas in one action from the panel.
- A payment's history view shows every attached receipt image, not just one.
- All items in `docs/DEFINITION_OF_DONE.md` checklist pass.

## Related documents

- `docs/phases/PHASE_27_MULTI_INSTALLMENT_PAYMENT.md` — backend model this phase consumes
- `docs/phasesClient/PHASE_12_PAYMENT_ATTACHMENTS.md` — the single-image upload flow this phase extends
