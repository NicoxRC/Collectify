# Phase 18 — Message Audiences, Cronjobs and Log Retention

## Goal

Let an admin attach a curated group of clients ("grupo de personas") to a message template, with its own schedulable cronjob, so the job only messages that group when it runs. Also let an admin manually retry a message that failed to send, without needing to keep every successfully-sent message log forever taking up attention in the retry workflow.

## Confirmed scope note — read before implementing

`docs/DATABASE.md`'s "Changed after Phase 9" section documents that `message_templates.content` was made deliberately read-only: WhatsApp/Meta only allows a business to *initiate* a conversation through a template Meta has pre-approved, so free-text editing in our own database doesn't reflect that reality and would just break sending. **The human confirmed directly that this remains true and is not being revisited**: templates stay static, created and approved in Meta, stored fixed in `message_templates` purely for display. This phase does **not** reopen `content` editing — its only new surface is the audience/cron layer on top of the existing four static templates.

## Resolved — confirmed directly with the human

With the content-editing question already resolved (templates stay static), four scoping questions were confirmed before writing any code:

1. **Additive vs. restrictive:** additive. The curated audience group is added on top of whoever the dynamic logic already includes (mora/upcoming-due) — it never narrows the dynamic set, it only extends it.
2. **Cron scope:** all four message types gain a configurable schedule, including `new_loan` and `account_summary` (previously on-demand/synchronous only). This is the bigger-change option the original brief flagged, confirmed deliberately.
3. **A curated-audience member who doesn't meet the dynamic condition** (e.g. added to the "mora" template's audience but has no overdue installments that day): the message is still sent, rendered with an empty installments list and a $0 grand total — not skipped, not an error. This is what makes "additive" actually add someone rather than being a silent no-op for them.
4. **`new_loan` cron mechanics** (the type with no natural recurring "who qualifies today" query, since it's inherently one loan's own disbursement event): the cron scans for loans whose new-loan message hasn't been sent yet (`Loan.newLoanMessageSentAt IS NULL`) and retries sending — a backup/retry mechanism, not a replacement for the existing synchronous send-at-creation, which remains the primary trigger. The curated audience concept doesn't apply here: there's no "an audience member's own new-loan content" to render for someone without a qualifying loan, so audience membership has no functional effect on this particular cron (documented explicitly rather than built silently inconsistent).
5. **`account_summary` cron mechanics** (the type with no dynamic condition at all — account summary isn't "who's overdue," it's "who wants a periodic full statement"): the cron sends only to clients in that template's curated audience, nothing else. Extended the same empty/$0-render principle from point 3 here too, by inference from the same underlying rule (a client in the audience with zero pending installments still gets sent an empty/$0 statement) — this specific extension wasn't asked verbatim but follows directly from the already-confirmed principle rather than being guessed independently.

These answers are final for this phase — do not revisit them without a new confirmation round with the human.

## Required reading before starting

`docs/phases/PHASE_9_MESSAGE_TYPES.md` (the templates/log model this phase extends), `docs/DATABASE.md` ("Changed after Phase 9" section specifically).

## Scope (once the above is confirmed)

### Entities and migrations
- [x] `MessageAudience` entity: `id`, `message_template_id` (FK), `name`, timestamps + soft delete. Related `Client`s via a `message_audience_clients` join table (TypeORM-managed `@ManyToMany`/`@JoinTable`, not a separate entity class — matches the join table's plain `message_audience_id`/`client_id` shape). One primary audience per template is the actual UI surface (see client scope), though the schema itself doesn't hard-restrict multiplicity.
- [x] Migration `CreateMessageAudiencesTables`.
- [x] `MessageTemplate.cronExpression` (nullable) — DB-backed schedule per template, replacing the env-var-only source the two existing jobs used; falls back to a per-type code default when null. Migration `AddCronExpressionToMessageTemplates`.
- [x] `MessageLog`: add `retried_at` (nullable) and `retry_of_message_log_id` (nullable, self-referencing FK) to track manual retries — no removal of existing "sent" row persistence. Migration `AddRetryFieldsToMessageLogs`.
- [x] `Loan.newLoanMessageSentAt` (nullable timestamp) — lets the new `new_loan` cron (point 4 above) find loans still needing their message, without the fragile message-content string-matching `LoanDetailPage.tsx` used before. Migration `AddNewLoanMessageSentAtToLoans`.

### Reminder services — allowEmpty
- [x] `OverdueReminderService.sendReminderForClient`, `UpcomingDueReminderService.sendReminderForClient`, `AccountSummaryService.sendAccountSummary` all accept an optional `{ allowEmpty?: boolean }` — default `false` preserves the existing throw-on-nothing-to-report behavior for the manual on-demand `POST /whatsapp/clients/:clientId/send-*` endpoints (unchanged); the cron paths pass `true` so audience-only members (point 3 above) get an empty/$0 message instead of an error.

### Cron consolidation
- [x] A single `WhatsappCronService` (replacing the separate `OverdueReminderCron`/`UpcomingDueReminderCron` files) registers all four jobs at boot, keyed by `MessageType`, reading each one's schedule from `MessageTemplate.cronExpression` with a code-level default fallback. Exposes generic `getStatus(type)`, `pause(type)`, `resume(type)`, `reschedule(type, expression)`.
- [x] `overdue`/`upcoming_due` job bodies: existing `runWeeklyReminder()`/`runDailyReminder()`, extended to union the dynamically-qualifying client list with the template's audience clients (point 1), calling `sendReminderForClient(clientId, { allowEmpty: true })` for the combined set.
- [x] `new_loan` job body: new `NewLoanReminderService.runPendingNotifications()` — finds loans with `newLoanMessageSentAt IS NULL`, retries `sendNewLoanMessage()`, marks the timestamp on success (point 4).
- [x] `account_summary` job body: new `AccountSummaryService.runAudienceSummaries()` — sends to every client in the template's audience only, with `allowEmpty: true` (point 5).

### Endpoints
- [x] `GET /api/v1/whatsapp/cron/:type/status`, `POST /api/v1/whatsapp/cron/:type/pause`, `POST /api/v1/whatsapp/cron/:type/resume`, `PATCH /api/v1/whatsapp/cron/:type/schedule` — replaces the old two hardcoded per-type route sets with one parametrized set covering all four types; a breaking route change made together with its only consumer (the client app) in this same phase, not left as a compatibility shim.
- [x] `GET /api/v1/message-templates/:type/audience`, `PUT /api/v1/message-templates/:type/audience` (upsert the single audience + its full client id list) — admin only.
- [x] `POST /api/v1/message-logs/:id/retry` — admin only (routed on the existing `MessageLogsController`, i.e. `/message-logs/:id/retry` rather than nested under `/whatsapp/`, matching that controller's already-established top-level path — a minor deviation from this doc's original path sketch, noted here rather than silently diverging).

### Tests (mandatory)
- [x] Audience upsert (create on first save, update membership on subsequent saves); `getClientIdsForTemplateType` unions correctly.
- [x] `allowEmpty`: manual on-demand calls still throw on nothing-to-report; cron-path calls with `allowEmpty: true` send an empty/$0 message instead.
- [x] Overdue/upcoming-due candidate list includes audience-only clients (additive), and manual send-now for a specific client is unaffected.
- [x] `new_loan` cron: only scans/sends for loans with `newLoanMessageSentAt IS NULL`; marks it on success; a loan whose synchronous send already succeeded is not retried.
- [x] `account_summary` cron: sends only to audience clients, empty/$0 when a member has nothing pending.
- [x] `WhatsappCronService`: reschedule takes effect without a redeploy (same guarantee the old pause/resume mechanism already had).
- [x] Manual retry: succeeds and logs correctly (new log row linked via `retryOfMessageLogId`, original row's `retriedAt` set); retrying an already-`sent` message is rejected with a clear error.

### Swagger
- [x] New/changed endpoints documented.

## Definition of done for this phase

- An admin can create and edit a group of clients attached to a message template.
- The confirmed additive interaction with dynamic recipient logic, and the empty/$0-send rule, are implemented exactly as agreed — not guessed.
- All four message types have an admin-editable cron schedule.
- A failed message can be manually retried without losing the original log entry.
- All items in `docs/DEFINITION_OF_DONE.md` checklist pass.

## After this phase

Update `docs/GLOSSARY.md` with "Message audience / Grupo de destinatarios" and `docs/DATABASE.md` with the new tables.

## Related documents

- `docs/phases/PHASE_5_WHATSAPP.md`, `docs/phases/PHASE_9_MESSAGE_TYPES.md` — the templates/cron/log model this phase extends
- `docs/DATABASE.md` — "Changed after Phase 9" section, the decision this phase does not reopen
