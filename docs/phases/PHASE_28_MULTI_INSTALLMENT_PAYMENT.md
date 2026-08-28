# Phase 28 — Multi-Installment Payments

## Goal

Let a collector register payments against several installments in one action, and attach more than one receipt photo to a single payment — today `POST /installments/:id/payments` (`InstallmentsService.registerPayment`) handles exactly one installment and exactly one `imageUrl` per call.

## Resolved — confirmed directly with the human (reunión 2026-08-25)

- **Multiple cuotas at once:** "que se pueda pagar varias cuotas a la vez."
- **Multiple receipts per cuota:** "subir sus comprobantes, hay personas que mandan más de un comprobante por cuota" — this is per-installment (a single cuota's payment can carry several receipt photos), not a single shared receipt across a multi-cuota batch.

## Resolved — confirmed directly with the human (2026-08-28)

- **Amount entry in a batch:** one amount typed individually per selected installment, not a single total auto-split.
- **Partial vs. full in a batch:** the batch requires **full** payment of every selected installment — partial payment stays on the existing single-installment flow, which already supports it.

## Required reading before starting

`docs/phases/PHASE_4_LOANS_INSTALLMENTS.md` (existing `registerPayment` this phase extends), `docs/phases/PHASE_12_PAYMENT_ATTACHMENTS.md` (the single-`imageUrl` pattern this phase widens to multiple), `docs/DATABASE.md` (`payments`).

## Scope (once the open questions above are confirmed)

### Entities and migrations
- [x] New table `payment_images`: `id`, `payment_id` (FK → `payments.id`, `ON DELETE CASCADE`), `image_url` (VARCHAR), `created_at`. Standard externally-hosted-URL-only convention, same as `payments.image_url` today.
- [x] Migration `CreatePaymentImagesTable`, plus a data migration copying any existing non-null `payments.image_url` into a `payment_images` row — **`payments.image_url` was NOT dropped in this phase**; deprecated in code (stopped writing to it, kept reading it as a fallback for old records).

### Service and API
- [x] `InstallmentsService.registerPayment` accepts `imageUrls: string[]` (replacing the singular `imageUrl`) and persists one `payment_images` row per URL.
- [x] New `POST /installments/payments/bulk`: accepts `{ payments: [{ installmentId, amountPaid, paidAt, observation?, imageUrls? }] }`, creates one `Payment` row per installment inside a single transaction — all succeed or all roll back, same transactional precedent as `LoansService.refinance()`. Rejects the whole batch with a 400 naming the offending installment if any entry's amount doesn't fully cover its remaining balance.

### Tests (mandatory)
- [x] A payment can be registered with multiple receipt images; all persist and are retrievable.
- [x] Bulk payment across N installments creates N `Payment` rows atomically; a failure partway rolls back all of them.
- [x] Existing single-installment, single-image `registerPayment` behavior is unchanged for callers that don't use the new bulk endpoint.

### Swagger
- [x] `POST /installments/:id/payments` and the new bulk endpoint documented, including the multi-image shape.

## Definition of done for this phase

- [x] A collector can register a payment against several installments in one action.
- [x] A single payment can carry more than one receipt photo.
- [x] No existing single-payment data or behavior is lost by the migration to `payment_images`.
- [x] All items in `docs/DEFINITION_OF_DONE.md` checklist pass.

## After this phase

Update `docs/DATABASE.md` (`payments`, new `payment_images` table) and note the deprecation timeline for `payments.image_url` in the "Changed after Phase 28" style used for prior deprecations in this doc.

## Related documents

- `docs/phases/PHASE_4_LOANS_INSTALLMENTS.md`, `docs/phases/PHASE_12_PAYMENT_ATTACHMENTS.md` — the payment flow this phase extends
- `docs/DATABASE.md`
