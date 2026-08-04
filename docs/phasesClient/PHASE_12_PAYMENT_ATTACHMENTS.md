# Phase 12 — Payment Attachments (Client)

## Goal

Let the collector attach a photo of the deposit receipt when registering a payment, and make both that photo and the payment's observation (a field that already exists on the backend today but is never rendered anywhere in the client — confirmed) visible in the payment history. Mirrors `docs/phases/PHASE_12_PAYMENT_ATTACHMENTS.md`.

## Required reading before starting

`docs/phases/PHASE_12_PAYMENT_ATTACHMENTS.md` (the `api` counterpart, including the image-provider recommendation).

## Scope

### Data layer
- [ ] `lib/imageUpload.ts` — thin wrapper around the chosen provider's client-side upload call (signed/unsigned upload), returning the hosted URL.
- [ ] `installmentsApi.ts` — extend `CreatePaymentInput`/`Payment` types with optional `imageUrl`, matching the `api`'s DTO exactly.

### Register payment
- [ ] `RegisterPaymentDialog.tsx` — add a file input with preview thumbnail. Upload happens before the payment is submitted (so `imageUrl` is available when `onConfirm` fires), with its own loading/error state distinct from the form submission state — an upload failure should not silently submit the payment without the image.

### Payment history
- [ ] Wherever `Payment[]` is rendered for an installment/loan (`LoanDetailPage.tsx`'s payment history section), render the existing `observation` field (currently not shown anywhere — confirmed) and, when present, the attached image as a thumbnail with a click-to-enlarge lightbox.

## Definition of done for this phase

- A payment can be registered with an attached photo, visible immediately afterward in the payment history alongside its observation.
- Registering a payment without a photo still works exactly as before.
- All items in `docs/DEFINITION_OF_DONE.md` checklist pass.

## Related documents

- `docs/phases/PHASE_12_PAYMENT_ATTACHMENTS.md` — the `api` counterpart and image-provider recommendation
