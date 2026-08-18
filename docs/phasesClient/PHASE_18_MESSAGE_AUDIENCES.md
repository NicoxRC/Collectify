# Phase 18 — Message Audiences, Cronjobs and Log Retention (Client)

## Goal

Let the admin manage a group of clients per message template and its schedule, and manually retry failed sends from the message log. Mirrors `docs/phases/PHASE_18_MESSAGE_AUDIENCES.md`. Template **content stays read-only** in this phase — confirmed directly with the human, this UI does not add content editing.

## Required reading before starting

`docs/phases/PHASE_18_MESSAGE_AUDIENCES.md` (the `api` counterpart, including its open questions on additive vs. restrictive audiences and cron scope).

## Scope

### Message templates
- [x] `MessageTemplatesPage.tsx`: keep `content` read-only exactly as it is today; add UI to view/create/edit the audience (group of clients) attached to each template — a client search/selector, similar to the one already used in `LoanForm.tsx`. One audience per template (`GET`/`PUT /message-templates/:type/audience`), confirmed with the human — not multiple named audiences, even though the `api`'s schema doesn't hard-restrict it.
- [x] **Added after client QA (2026-08-18):** for the `overdue` and `upcoming_due` audience editors specifically, a red warning line under "Grupo de destinatarios" — the audience became a required filter for those two types (see `docs/phases/PHASE_18_MESSAGE_AUDIENCES.md` "Extended after client QA"), so an empty group silently means nobody gets that reminder.
- [x] ~~Per-template cron schedule control, for **all four** message types~~ — **corrected later the same day (2026-08-18):** `new_loan` has neither a schedule nor an audience editor (it's sent once, synchronously, at loan creation — `MessageTemplatesPage.tsx` shows a one-line note instead of either control), and `account_summary` lost its audience editor too (also a one-line note; it now sends to every client with an active loan automatically, no group to manage). Only `overdue` and `upcoming_due` still show `TemplateAudienceEditor`; only `overdue`, `upcoming_due`, and `account_summary` still show a schedule control.
- [x] **Added same round:** bulk client selection in `TemplateAudienceEditor` (the only two instances left, `overdue`/`upcoming_due`) — search results stay visible as a checkbox list instead of vanishing after each add, plus "Agregar todos"/"Quitar todos" for the whole visible batch. One-by-one search-and-add was confirmed too tedious for adding/removing many clients at once.
- [x] **Corrected later the same day (2026-08-18):** the inline checkbox list (capped at 100 results, no pagination) didn't scale to hundreds of clients. Replaced with a `ClientPickerModal` opened via a "+ Agregar clientes" button — a real paginated list (`useClients` with `page`/`limit`, mirroring `ClientsListPage.tsx`'s pagination pattern) with search and "Agregar todos"/"Quitar todos" scoped to the current page only. `TemplateAudienceEditor` itself now only lists the group's current (usually much smaller) membership, unpaginated, with per-client removal.
- [x] **Added same round:** `TemplateCronControl`'s raw cron-expression text field replaced with a periodicity (`Cada día`/`Cada semana`/`Cada 15 días`/`Cada mes`) + time-of-day picker, converted to a cron expression under the hood via `cronScheduleUtils.ts` (`buildCronExpression`/`parseCronExpression`, unit-tested). A stored expression the picker can't represent (e.g. multiple weekdays in one field) falls back to a safe default rather than guessing.

### Message logs
- [x] `MessageLogsPage.tsx`: add a "Reintentar" row action on failed rows, using the same `RowAction` component pattern already used in `ClientRow.tsx`.

## Definition of done for this phase

- An admin can manage a curated group of clients per template and its send schedule, without any change to how template content itself is edited (it isn't).
- A failed message can be retried directly from the message log list.
- All items in `docs/DEFINITION_OF_DONE.md` checklist pass.

## Related documents

- `docs/phases/PHASE_18_MESSAGE_AUDIENCES.md` — the `api` counterpart
