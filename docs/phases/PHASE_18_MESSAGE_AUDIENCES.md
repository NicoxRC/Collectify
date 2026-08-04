# Phase 18 — Message Audiences, Cronjobs and Log Retention

## Goal

Let an admin attach a curated group of clients ("grupo de personas") to a message template, with its own schedulable cronjob, so the job only messages that group when it runs. Also let an admin manually retry a message that failed to send, without needing to keep every successfully-sent message log forever taking up attention in the retry workflow.

## Confirmed scope note — read before implementing

`docs/DATABASE.md`'s "Changed after Phase 9" section documents that `message_templates.content` was made deliberately read-only: WhatsApp/Meta only allows a business to *initiate* a conversation through a template Meta has pre-approved, so free-text editing in our own database doesn't reflect that reality and would just break sending. **The human confirmed directly that this remains true and is not being revisited**: templates stay static, created and approved in Meta, stored fixed in `message_templates` purely for display. This phase does **not** reopen `content` editing — its only new surface is the audience/cron layer on top of the existing four static templates.

## Before starting this phase — stop and confirm with the human

With the content-editing question already resolved, two scoping questions remain:

1. For the four existing types with dynamically-computed recipients (mora, upcoming due, new loan, account summary) — is the curated group of people **additive** (the curated group is added to whoever the dynamic logic already includes) or **restrictive** (only people in the curated group who also meet the dynamic condition get messaged)? The dynamic logic itself (who is overdue, who has an installment coming due) cannot be replaced by a static group — it changes daily — so this question is about how the two coexist, not about removing dynamic targeting.
2. Cron per template: should only the two jobs that are already scheduled (overdue, upcoming due) get a configurable schedule, or should all four types (including `new_loan` and `account_summary`, which are today on-demand/synchronous, not cron-driven) gain their own schedule? Making the latter two cron-driven is a bigger behavior change than just exposing a schedule field.

**Do not pick answers and build it — ask the human.**

## Required reading before starting

`docs/phases/PHASE_9_MESSAGE_TYPES.md` (the templates/log model this phase extends), `docs/DATABASE.md` ("Changed after Phase 9" section specifically).

## Scope (once the above is confirmed)

### Entities and migrations
- [ ] `MessageAudience` entity: `id`, `message_template_id` (FK), `name`, timestamps + soft delete.
- [ ] `MessageAudienceClient` join table: `message_audience_id`, `client_id`.
- [ ] Migration `CreateMessageAudiencesTables`.

### Cron configurability
- [ ] Extend the existing `SchedulerRegistry`-based pause/resume mechanism (already built for the overdue and upcoming-due jobs) with an editable cron expression per job, scoped to whichever types are confirmed in scope above.

### Message log retry
- [ ] `MessageLog`: no removal of existing "sent" row persistence (the historical record of what was actually told to a client, relevant for collections disputes, stays intact) — add `retried_at` (nullable) and `retry_of_message_log_id` (nullable FK, self-reference) to track manual retries.
- [ ] `POST /api/v1/whatsapp/message-logs/:id/retry` — admin only, re-attempts sending a failed message and logs the retry attempt.

### Tests (mandatory)
- [ ] Audience creation/editing; sending logic respects the confirmed additive/restrictive rule for dynamic types.
- [ ] Cron schedule changes take effect without requiring a redeploy (same mechanism already proven for pause/resume).
- [ ] Manual retry: succeeds and logs correctly; retrying an already-sent message is rejected with a clear error.

### Swagger
- [ ] New endpoints documented.

## Definition of done for this phase

- An admin can create and edit a group of clients attached to a message template.
- The confirmed additive/restrictive interaction with dynamic recipient logic is implemented exactly as agreed — not guessed.
- A failed message can be manually retried without losing the original log entry.
- All items in `docs/DEFINITION_OF_DONE.md` checklist pass.

## After this phase

Update `docs/GLOSSARY.md` with "Message audience / Grupo de destinatarios" and `docs/DATABASE.md` with the new tables.

## Related documents

- `docs/phases/PHASE_5_WHATSAPP.md`, `docs/phases/PHASE_9_MESSAGE_TYPES.md` — the templates/cron/log model this phase extends
- `docs/DATABASE.md` — "Changed after Phase 9" section, the decision this phase does not reopen
