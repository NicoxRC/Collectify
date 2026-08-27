# Phase 32 — UI Fixes and Small Corrections

## Goal

A bundle of smaller corrections flagged directly by the client (reunión 2026-08-25), none of which touch a financial calculation — bugs and rough edges, not new business rules. Grouped into one phase per this project's precedent for miscellaneous polish work (see `docs/phasesClient/PHASE_8_POLISH.md`).

## Resolved — confirmed directly with the human

- **Sequential payment enforcement:** "el botón de pagar está habilitado para todas las cuotas, o sea que podría pagar la cuota novena sin haber pagado las anteriores" — an installment shouldn't be payable while an earlier-numbered installment on the same loan is still pending.
- **"Cotizador" renamed to "Proyector rápido"** — no functional change, name only (see `docs/phases/PHASE_14_INTEREST_CONCEPTS.md`, which shipped it under the old name).
- **Confirmation step before liquidating a credit** — "agregar botón de confirmación al liquidar el crédito" (the existing `POST /loans/:id/payoff` flow, `docs/phases/PHASE_16_EARLY_PAYOFF.md`, currently has none).

## Scope

### Backend (defense in depth, not just a UI-disabled button)
- [ ] `InstallmentsService.registerPayment`: reject (400) a payment against installment N if any installment with a lower `installment_number` on the same loan is still `pending` — a real server-side rule, since a disabled button alone doesn't stop a direct API call.
- [ ] Audit log detail: whatever currently renders as an unreadable raw code in a movement's "ver detalle" view — investigate `AuditLog.metadata`'s JSON rendering in that response and confirm the fix is presentation-only (label the known fields clearly) and not a sign `entity_label`/`metadata` themselves are malformed for that action type.
- [ ] Message history: `GET /message-logs` (or wherever the "0 enviados" figure is computed/returned) — remove or correct whatever produced a misleading always-zero "enviados" count; per the client's own framing this list should only be surfacing failures, not a sent-count that's always wrong.

### Tests (mandatory)
- [ ] Paying installment N is rejected while any earlier installment on the same loan is still pending; succeeds once they're all paid/cancelled.
- [ ] Audit log detail fix covered by a test asserting the specific field that was previously unreadable now renders correctly.

### Swagger
- [ ] `POST /installments/:id/payments` error response documented for the new sequential-payment rejection.

## Definition of done for this phase

- Every item above is fixed with no change to any amount owed, interest calculation, or message content.
- The sequential-payment rule is enforced server-side, not just hidden in the UI.
- All items in `docs/DEFINITION_OF_DONE.md` checklist pass.

## Related documents

- `docs/phasesClient/PHASE_32_UI_FIXES.md` — the client-side half of this bundle
- `docs/phases/PHASE_16_EARLY_PAYOFF.md`, `docs/phases/PHASE_14_INTEREST_CONCEPTS.md`, `docs/phases/PHASE_11_AUDIT_LOG.md` — the flows this phase's fixes touch
