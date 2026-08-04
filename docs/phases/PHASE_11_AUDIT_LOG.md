# Phase 11 — Audit Logging

## Goal

Record who did what, and when, across the system's sensitive actions — creating/editing/deleting clients, loans, payments, users, templates, and permissions — so the business has a real accountability trail instead of "nobody knows who registered this payment." Sequenced early (right after Phase 10) so every phase built afterward is covered from day one, instead of retrofitting an ad hoc "who did this" column onto each entity individually.

## Required reading before starting

`docs/ARCHITECTURE.md` (NestJS module conventions, the existing global response interceptor from Phase 1 as a reference for how interceptors are wired in this project), `.agents/skills/nestjs-best-practices` (interceptor pattern).

## Scope decisions — read before implementing

- **This is a generic, interceptor-based log, not hand-added logging calls sprinkled through every service.** A NestJS interceptor reading `@CurrentUser()` and route metadata is far less error-prone than remembering to call `auditLogService.log(...)` in every mutating service method — a forgotten call anywhere silently breaks the trail. Implement it once, apply it broadly.
- **Append-only, no `deleted_at`.** Same convention already used for `message_logs`/`message_log_items` — an audit trail that can itself be edited or deleted defeats its purpose.
- **`InstallmentsController.registerPayment` currently does not capture the authenticated user at all** (confirmed — no `@CurrentUser()` usage anywhere in that controller). This phase fixes that as part of making payment registration an audited action, satisfying "que al registrar pagos se registre que usuario lo hizo" without needing a separate denormalized column on `Payment` — the audit log entry itself is the record of who registered it. If a quick "registered by" display on the payment history table (client side) turns out to need a faster lookup than joining audit logs, that's a Phase 12 (Payment attachments) frontend concern, not a backend schema change here.

## Scope

### Entities and migrations
- [ ] `AuditLog` entity: `id` (UUID), `actor_user_id` (FK → `users`, nullable — some actions may not have an authenticated actor, e.g. a cron job), `action` (VARCHAR — e.g. `client.create`, `loan.refinance`, `payment.register`, `user.deactivate`; document the naming convention: `<entityType>.<verb>`), `entity_type` (VARCHAR), `entity_id` (UUID, nullable), `metadata` (JSONB — relevant before/after fields or request payload), `created_at` (TIMESTAMPTZ). No `updated_at`/`deleted_at`.
- [ ] Migration `CreateAuditLogsTable`.
- [ ] Index on `(entity_type, entity_id)` and `(actor_user_id, created_at)` — mirrors the indexing rationale already documented for `message_logs` in `DATABASE.md`.

### Interceptor
- [ ] `AuditLogInterceptor` — applied globally or via a `@Audit(action, entityType)` decorator on mutating endpoints (POST/PATCH/DELETE), capturing `@CurrentUser()`, the route's declared action/entity type, and relevant response/request data into `metadata`.
- [ ] Apply the decorator to at minimum: client create/update/deactivate/reactivate (Phase 10), user create/deactivate/reactivate, loan create/refinance, payment registration, and (once they exist) message template audience changes and permission changes.

### Service and API
- [ ] `AuditLogModule`, `AuditLogService.findAll(query)` — filters: `actorUserId`, `action`, `entityType`, date range; paginated. Mirror `MessageLogsService`'s filter/pagination shape.
- [ ] `GET /api/v1/audit-logs` — admin only.

### Tests (mandatory)
- [ ] `AuditLogInterceptor`: captures actor and metadata correctly for a representative mutating endpoint; a failed request does not produce a misleading "success" log entry.
- [ ] `AuditLogService.findAll()`: filters behave correctly individually and combined.

### Swagger
- [ ] `GET /api/v1/audit-logs` documented with all filter params.

## Definition of done for this phase

- Every mutating action listed above produces exactly one audit log entry with the correct actor.
- `GET /api/v1/audit-logs` lets an admin answer "who did X" for any of the covered actions.
- All items in `docs/DEFINITION_OF_DONE.md` checklist pass.

## After this phase

Add an "Audit log" entry to `docs/GLOSSARY.md` and a `audit_logs` table section to `docs/DATABASE.md`.

## Related documents

- `docs/phases/PHASE_10_CLIENT_CAPACITY.md` — first phase whose actions this log should cover
- `docs/ARCHITECTURE.md` — interceptor conventions
