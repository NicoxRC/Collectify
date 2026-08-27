# Phase 27 — Multi-Installment Payments

## Goal

Let a collector register payments against several installments in one action, and attach more than one receipt photo to a single payment — today `POST /installments/:id/payments` (`InstallmentsService.registerPayment`) handles exactly one installment and exactly one `imageUrl` per call.

## Resolved — confirmed directly with the human (reunión 2026-08-25)

- **Multiple cuotas at once:** "que se pueda pagar varias cuotas a la vez."
- **Multiple receipts per cuota:** "subir sus comprobantes, hay personas que mandan más de un comprobante por cuota" — this is per-installment (a single cuota's payment can carry several receipt photos), not a single shared receipt across a multi-cuota batch.

## Open questions — confirm before implementing

- [ ] When paying several installments in one action, is the total amount entered once and split across the selected installments (e.g. evenly, or oldest-first), or is each installment's amount entered individually within the same batch action? Not addressed by the resolved answers above — confirm before building the form/DTO shape, since this materially changes both the UI and the request payload.
- [ ] Does a bulk action require full payment of every selected installment, or does it also need to support partial payment per installment within the batch (partial payments are already allowed one-at-a-time, per `docs/DATABASE.md`)?

## Required reading before starting

`docs/phases/PHASE_4_LOANS_INSTALLMENTS.md` (existing `registerPayment` this phase extends), `docs/phases/PHASE_12_PAYMENT_ATTACHMENTS.md` (the single-`imageUrl` pattern this phase widens to multiple), `docs/DATABASE.md` (`payments`).

## Scope (once the open questions above are confirmed)

### Entities and migrations
- [ ] New table `payment_images`: `id`, `payment_id` (FK → `payments.id`, `ON DELETE CASCADE`), `image_url` (VARCHAR), `created_at`. Standard externally-hosted-URL-only convention, same as `payments.image_url` today.
- [ ] Migration `CreatePaymentImagesTable`, plus a data migration copying any existing non-null `payments.image_url` into a `payment_images` row — **do not drop `payments.image_url` in this phase**; deprecate it in code (stop writing to it, keep reading it as a fallback for old records) and revisit dropping it in a later cleanup once every existing record has been backfilled and verified.

### Service and API
- [ ] `InstallmentsService.registerPayment` accepts `imageUrls: string[]` (in addition to, or replacing, the singular `imageUrl` — per the migration approach above) and persists one `payment_images` row per URL.
- [ ] New `POST /installments/payments/bulk` (exact path TBD against `ARCHITECTURE.md` conventions): accepts an array of per-installment payment entries (shape per the open "how is the total split" question above), creates one `Payment` row per installment inside a single transaction — all succeed or all roll back, same transactional precedent as `LoansService.refinance()`.

### Tests (mandatory)
- [ ] A payment can be registered with multiple receipt images; all persist and are retrievable.
- [ ] Bulk payment across N installments creates N `Payment` rows atomically; a failure partway rolls back all of them.
- [ ] Existing single-installment, single-image `registerPayment` behavior is unchanged for callers that don't use the new bulk endpoint.

### Swagger
- [ ] `POST /installments/:id/payments` and the new bulk endpoint documented, including the multi-image shape.

## Definition of done for this phase

- A collector can register a payment against several installments in one action.
- A single payment can carry more than one receipt photo.
- No existing single-payment data or behavior is lost by the migration to `payment_images`.
- All items in `docs/DEFINITION_OF_DONE.md` checklist pass.

## After this phase

Update `docs/DATABASE.md` (`payments`, new `payment_images` table) and note the deprecation timeline for `payments.image_url` in the "Changed after Phase 27" style used for prior deprecations in this doc.

## Related documents

- `docs/phases/PHASE_4_LOANS_INSTALLMENTS.md`, `docs/phases/PHASE_12_PAYMENT_ATTACHMENTS.md` — the payment flow this phase extends
- `docs/DATABASE.md`
