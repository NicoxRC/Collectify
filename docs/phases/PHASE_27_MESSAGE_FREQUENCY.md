# Phase 27 — Personalized Messaging Frequency (Replaces Message Audiences)

## Goal

Remove the curated "message audience" concept (Phase 18) that currently acts as a required filter gating who receives the `overdue`/`upcoming_due` reminders, and replace it with a whitelist that changes how *often* specific clients are messaged, not *whether* they're messaged at all.

## Resolved — confirmed directly with the human (reunión 2026-08-25)

- **Groups are eliminated entirely:** "en los mensajes de envío se elimina totalmente los grupos (se manda a todos los clientes que apliquen)." Every client who dynamically qualifies (has an overdue installment / one approaching due) is messaged on every cron run, exactly like the system behaved *before* Phase 18's "audience is a required filter" reversal — that reversal is itself now reversed.
- **A whitelist controls frequency, not eligibility:** "en cambio tendríamos una whitelist en la que los que se agreguen cambia la frecuencia" — from the original meeting note this replaces: normal clients get a message roughly every other day (matching the existing `overdue` cron cadence), while "preferential" clients on the whitelist get throttled down to about once a week.

## Open questions — confirm before implementing

- [ ] **Exact frequency values** — the meeting note's "cada 1 en semana" for preferential clients vs. "pasando un día" for everyone else was the client's informal framing; confirm the precise number of days (or whether it should be admin-configurable per client rather than a single fixed value) before hardcoding anything.
- [ ] **Scope: which message types does the whitelist apply to?** The client's own framing only mentioned the `overdue` and `upcoming_due` reminders ("recordatorio que se va a vencer y recordatorio de cuentas vencidas") — confirm `account_summary`'s own cron (Phase 18, sends to every client with an active loan) and the synchronous `new_loan` send are explicitly out of scope, rather than assuming.
- [ ] Does throttling suppress a cron run for that client entirely, or does it still log something (e.g. an internal skip record) for auditability? `docs/DATABASE.md`'s "Resolved from Phase 18" already established the precedent that an audience member with nothing to report still gets an empty/$0 message rather than being silently skipped — confirm whether that same "never silently skip" philosophy should extend to a throttled-but-qualifying client, or whether a throttle is a deliberate, silent skip by design.

## Required reading before starting

`docs/phases/PHASE_18_MESSAGE_AUDIENCES.md` (the mechanism this phase removes/replaces — read in full, including its multiple client-QA reversals, to avoid re-introducing a design already tried and reversed), `docs/GLOSSARY.md` ("Message audience").

## Scope (once the open questions above are confirmed)

### Entities and migrations
- [ ] New table, e.g. `client_message_frequencies`: `id`, `client_id` (FK → `clients.id`, `ON DELETE CASCADE`), `minimum_days_between_messages` (INT), `created_at`/`updated_at`. Scope (all cron message types vs. `overdue`/`upcoming_due` only) per the open question above.
- [ ] Migration `CreateClientMessageFrequenciesTable`.
- [ ] Deprecate `message_audiences`/`message_audience_clients` for `overdue`/`upcoming_due` specifically — **do not drop the tables** in this phase; `account_summary`'s cron already doesn't use them (Phase 18 "Extended further, same day"), and dropping schema that may still hold historical meaning needs its own confirmed migration, not a side effect of this phase.

### Service and API
- [ ] `OverdueReminderService.runWeeklyReminder()` / `UpcomingDueReminderService.runDailyReminder()`: revert to sending to every dynamically-qualifying client (undo Phase 18's audience-intersection filter), then apply the new throttle — for a client with a `client_message_frequencies` row, skip this run if fewer than `minimum_days_between_messages` have passed since their last `message_logs` row of that type; a client with no row is never throttled.
- [ ] `GET`/`PUT /clients/:id/message-frequency` (or similar) — admin-only, manage a client's whitelist entry.
- [ ] Remove or retire the `overdue`/`upcoming_due` audience editor endpoints (`GET`/`PUT /message-templates/:type/audience`) for these two types once confirmed no longer needed — `account_summary`'s "no audience at all" behavior and `new_loan`'s synchronous-only send are already unaffected and stay as-is.

### Tests (mandatory)
- [ ] A qualifying client with no frequency override is messaged on every cron run (restores pre-Phase-18-reversal behavior).
- [ ] A qualifying client with a frequency override is skipped on a run that falls inside their minimum-days window, and included once that window has elapsed.
- [ ] An empty/nonexistent whitelist never blocks anyone — confirms the audience-as-required-filter behavior is actually gone, not just bypassed for one code path.

### Swagger
- [ ] New/changed endpoints documented; `docs/phases/PHASE_18_MESSAGE_AUDIENCES.md`-referencing Swagger descriptions on the affected controllers updated to point here instead.

## Definition of done for this phase

- Every dynamically-qualifying client is messaged by `overdue`/`upcoming_due`, with no group to populate first.
- A whitelisted client's send frequency is throttled exactly per the confirmed rule, not guessed.
- All items in `docs/DEFINITION_OF_DONE.md` checklist pass.

## After this phase

Update `docs/GLOSSARY.md`'s "Message audience / Grupo de destinatarios" entry (replace with the new frequency-whitelist concept) and `docs/DATABASE.md`'s `message_audiences` section to note it's retired for `overdue`/`upcoming_due`, plus the new `client_message_frequencies` table.

## Related documents

- `docs/phases/PHASE_18_MESSAGE_AUDIENCES.md` — the mechanism this phase removes/replaces
- `docs/phases/PHASE_5_WHATSAPP.md`, `docs/phases/PHASE_9_MESSAGE_TYPES.md` — the underlying cron/template model, unaffected
- `docs/DATABASE.md`, `docs/GLOSSARY.md`
