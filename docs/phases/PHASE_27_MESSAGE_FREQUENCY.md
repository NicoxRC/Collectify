# Phase 27 — Personalized Messaging Frequency (Replaces Message Audiences)

## Goal

Remove the curated "message audience" concept (Phase 18) that currently acts as a required filter gating who receives the `overdue`/`upcoming_due` reminders, and replace it with a whitelist that changes how *often* specific clients are messaged, not *whether* they're messaged at all.

## Resolved — confirmed directly with the human (reunión 2026-08-25)

- **Groups are eliminated entirely:** "en los mensajes de envío se elimina totalmente los grupos (se manda a todos los clientes que apliquen)." Every client who dynamically qualifies (has an overdue installment / one approaching due) is messaged on every cron run, exactly like the system behaved *before* Phase 18's "audience is a required filter" reversal — that reversal is itself now reversed.
- **A whitelist controls frequency, not eligibility:** "en cambio tendríamos una whitelist en la que los que se agreguen cambia la frecuencia" — from the original meeting note this replaces: normal clients get a message roughly every other day (matching the existing `overdue` cron cadence), while "preferential" clients on the whitelist get throttled down to about once a week.

## Open questions — resolved (confirmed with the human, 2026-08-30)

- [x] **Exact frequency values** — no single fixed value hardcoded. `minimum_days_between_messages` is a per-row field on `client_message_frequencies`, set freely by the admin for each whitelisted client via `PUT /clients/:id/message-frequency` — the "cada 1 en semana" framing from the meeting note is a suggestion for the admin to type in, not a code constant.
- [x] **Scope: which message types does the whitelist apply to?** Confirmed: `overdue`/`upcoming_due` only, matching the client's own framing. `account_summary` (sends to every client with an active loan) and the synchronous `new_loan` send are unaffected.
- [x] **Silent skip vs. internal record** — confirmed: a throttled skip is silent by design, no internal record kept. This is a deliberate departure from Phase 18's "audience member with nothing to report still gets an empty/$0 message" precedent — that rule doesn't extend here.

## Required reading before starting

`docs/phases/PHASE_18_MESSAGE_AUDIENCES.md` (the mechanism this phase removes/replaces — read in full, including its multiple client-QA reversals, to avoid re-introducing a design already tried and reversed), `docs/GLOSSARY.md` ("Message audience").

## Scope (once the open questions above are confirmed)

### Entities and migrations
- [x] New table `client_message_frequencies`: `id`, `client_id` (FK → `clients.id`, `ON DELETE CASCADE`, **UNIQUE** — a genuine 1:1 relationship, unlike `message_audiences`' "multiple allowed, use the most recent" pattern), `minimum_days_between_messages` (INT), `created_at`/`updated_at`. Scoped to `overdue`/`upcoming_due` only, per the resolved open question above.
- [x] Migration `CreateClientMessageFrequenciesTable1785800000000`.
- [x] `message_audiences`/`message_audience_clients` deprecated for `overdue`/`upcoming_due` — tables NOT dropped (see `docs/DATABASE.md`).

### Service and API
- [x] `OverdueReminderService.runWeeklyReminder()` / `UpcomingDueReminderService.runDailyReminder()`: revert to sending to every dynamically-qualifying client (audience-intersection filter removed), then apply the new throttle via `MessageFrequencyThrottleService.filterOutThrottledClients()` — for a client with a `client_message_frequencies` row, skip this run if fewer than `minimum_days_between_messages` have passed since their most recent `message_logs` row of that type (sent OR failed); a client with no row is never throttled.
- [x] `GET`/`PUT`/`DELETE /clients/:id/message-frequency` — admin-only (`ClientsController`), manage a client's whitelist entry. Lives on `ClientsController` (not `MessageTemplatesController`) since the entry belongs to the client, not the template — matches the confirmed per-client (not per-template) framing.
- [x] `GET`/`PUT /message-templates/:type/audience` removed entirely (not left as a no-op) — `MessageAudiencesService`, its spec, and `UpdateMessageAudienceDto` are now orphaned/dead code, left for the human to `git rm` (matches how `clientsImportParser.ts` was handled earlier in this project). `account_summary`'s "no audience at all" behavior and `new_loan`'s synchronous-only send are unaffected and stay as-is.

### Tests (mandatory)
- [x] A qualifying client with no frequency override is messaged on every cron run (restores pre-Phase-18-reversal behavior) — `overdueReminder.service.spec.ts`/`upcomingDueReminder.service.spec.ts`.
- [x] A qualifying client with a frequency override is skipped on a run that falls inside their minimum-days window, and included once that window has elapsed — `messageFrequencyThrottle.service.spec.ts`.
- [x] An empty/nonexistent whitelist never blocks anyone — `messageFrequencyThrottle.service.spec.ts`.

### Swagger
- [x] New/changed endpoints documented (`ClientsController`'s 3 new endpoints); `MessageTemplatesController`'s Swagger updated to explain why the audience endpoints are gone, pointing to this phase.

## Definition of done for this phase

- [x] Every dynamically-qualifying client is messaged by `overdue`/`upcoming_due`, with no group to populate first.
- [x] A whitelisted client's send frequency is throttled exactly per the confirmed rule, not guessed.
- [x] All items in `docs/DEFINITION_OF_DONE.md` checklist pass — lint/test/build verified across both apps (2026-08-30).

## After this phase

`docs/GLOSSARY.md`'s "Message audience / Grupo de destinatarios" entry has been marked retired and a new "Message frequency whitelist" entry added; `docs/DATABASE.md`'s `message_audiences` section notes it's retired for `overdue`/`upcoming_due`, plus the new `client_message_frequencies` table documented.

## Related documents

- `docs/phases/PHASE_18_MESSAGE_AUDIENCES.md` — the mechanism this phase removes/replaces
- `docs/phases/PHASE_5_WHATSAPP.md`, `docs/phases/PHASE_9_MESSAGE_TYPES.md` — the underlying cron/template model, unaffected
- `docs/DATABASE.md`, `docs/GLOSSARY.md`
