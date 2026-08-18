# Phase 18 — Message Audiences, Cronjobs and Log Retention (Client)

## Goal

Let the admin manage a group of clients per message template and its schedule, and manually retry failed sends from the message log. Mirrors `docs/phases/PHASE_18_MESSAGE_AUDIENCES.md`. Template **content stays read-only** in this phase — confirmed directly with the human, this UI does not add content editing.

## Required reading before starting

`docs/phases/PHASE_18_MESSAGE_AUDIENCES.md` (the `api` counterpart, including its open questions on additive vs. restrictive audiences and cron scope).

## Scope

### Message templates
- [x] `MessageTemplatesPage.tsx`: keep `content` read-only exactly as it is today; add UI to view/create/edit the audience (group of clients) attached to each template — a client search/selector, similar to the one already used in `LoanForm.tsx`. One audience per template (`GET`/`PUT /message-templates/:type/audience`), confirmed with the human — not multiple named audiences, even though the `api`'s schema doesn't hard-restrict it.
- [x] Per-template cron schedule control, for **all four** message types (confirmed — bigger scope than just the two already-scheduled jobs), mirroring and generalizing the existing pause/resume control already built for the overdue reminder: status/pause/resume/reschedule against the new parametrized `GET`/`POST /whatsapp/cron/:type/...` routes.

### Message logs
- [x] `MessageLogsPage.tsx`: add a "Reintentar" row action on failed rows, using the same `RowAction` component pattern already used in `ClientRow.tsx`.

## Definition of done for this phase

- An admin can manage a curated group of clients per template and its send schedule, without any change to how template content itself is edited (it isn't).
- A failed message can be retried directly from the message log list.
- All items in `docs/DEFINITION_OF_DONE.md` checklist pass.

## Related documents

- `docs/phases/PHASE_18_MESSAGE_AUDIENCES.md` — the `api` counterpart
