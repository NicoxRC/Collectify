# Phase 5 — WhatsApp Reminders (Backend)

## Goal
The weekly automated reminder — the feature that actually replaces the client's current manual WhatsApp process. **One consolidated message per client, covering every overdue installment across all of their loans.**

## Required reading before starting
`docs/GLOSSARY.md` → "Overdue reminder" section has the exact real message structure. `docs/DATABASE.md` → `message_templates`, `message_logs`, `message_log_items` tables and the placeholder structure.

## Scope

### Entities and migrations
- [ ] `MessageTemplate` entity: `id`, `name`, `content`, `is_active`, standard timestamps + soft delete
- [ ] `MessageLog` entity: `id`, `client_id` (FK), `phone_number`, `message_content`, `status` (enum: `sent`, `failed`), `sent_at`, `created_at` only (append-only, no `updated_at`/`deleted_at` per `docs/DATABASE.md`)
- [ ] `MessageLogItem` entity: `id`, `message_log_id` (FK), `installment_id` (FK), `overdue_days_snapshot`, `interest_snapshot`, `created_at` only (append-only)
- [ ] Migrations for all three

### WhatsApp integration
- [ ] `WhatsAppService` wrapping Meta Cloud API calls, using `META_WHATSAPP_*` env vars
- [ ] **Graceful degradation required:** since these credentials aren't set up yet (see `docs/ENVIRONMENT_VARIABLES.md`), the service must log a warning and skip the actual send when they're empty, rather than crashing — this must not block development of the rest of this phase

### Message template system
- [ ] `MessageTemplatesController`/`Service`: list, create, edit, activate (deactivates all others when one is activated — enforce "only one active" at the service level)
- [ ] Template rendering logic: given a client and their list of overdue installments (each with computed overdue days, interest, total due), render the final message matching the real format from `docs/GLOSSARY.md`:
  ```
  [Greeting with client name]
  1️⃣ La cuota No. X del pagaré #Y por $Z (incluidos intereses) venció hace N días.
  2️⃣ ...
  El valor a pagar hoy es $[grand total]
  ```

### The weekly CronJob — the most important piece of this phase

- [ ] `overdueReminder.cron.ts` using `@nestjs/schedule`'s `@Cron()`, schedule controlled by `OVERDUE_REMINDER_CRON` env var
- [ ] **Logic must group by client, not by loan or installment** — this is the single most important behavioral requirement in this phase, confirmed directly from real client messages:
  ```
  for each client with at least one overdue installment (across ANY of their active loans):
      gather all of that client's overdue installments (join across all their active loans)
      calculate overdue days + interest for each (using Phase 4's calculation logic)
      render one message covering all of them, with a grand total
      send via WhatsAppService
      create one MessageLog row
      create one MessageLogItem row per included installment, storing the overdue_days/interest snapshot at send time
  ```
- [ ] Pause/resume control via `SchedulerRegistry`, exposed through an admin-only endpoint
- [ ] Manual "send now" endpoint for a specific client — same grouping/rendering logic, triggered on demand instead of by the cron schedule

### Endpoints
- [ ] `GET/POST/PATCH /api/v1/message-templates`, `POST /api/v1/message-templates/:id/activate`
- [ ] `GET /api/v1/message-logs` — paginated, filter by client, date range, status
- [ ] `POST /api/v1/whatsapp/cron/pause` / `resume` — admin only
- [ ] `POST /api/v1/whatsapp/clients/:clientId/send-reminder` — manual trigger, admin only

### Tests (mandatory)
- [ ] `WhatsAppService`: graceful skip when credentials are missing (don't test actual Meta API calls — mock them)
- [ ] Message rendering logic: single overdue installment, multiple installments across multiple loans, grand total calculation
- [ ] `MessageTemplatesService`: activating a template deactivates all others
- [ ] The cron job's grouping logic (this can be tested at the service level even without testing the `@Cron()` scheduling mechanism itself — test the "gather + render + send" logic as a plain method)

### Swagger
- [ ] All endpoints documented

## Definition of done for this phase

- Running the reminder logic manually against seeded test data (a client with overdue installments across 2+ loans) produces a single message with the correct format and grand total, matching the real message structure
- With WhatsApp credentials unset, the system logs a warning and records the attempt without crashing
- All items in `docs/DEFINITION_OF_DONE.md` checklist pass

## Do not build in this phase

Refinancing — that's Phase 6. Dashboard/reporting — that's Phase 7.
