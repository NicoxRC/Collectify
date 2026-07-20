# Phase 5 — WhatsApp Reminders (Client)

## Goal
Admin-facing UI for the weekly overdue reminder system: manage the message template, view sent history, manually trigger a reminder, and pause/resume the cron. Mirrors `docs/phases/PHASE_5_WHATSAPP.md`.

## Required reading before starting
`docs/GLOSSARY.md` → "Overdue reminder" for the real message structure. `docs/DATABASE.md` → `message_templates`, `message_logs`, `message_log_items`.

## Scope

### Data layer
- [ ] `features/messageTemplates/messageTemplatesApi.ts`, `useMessageTemplates.ts` — list, create, edit, activate
- [ ] `features/whatsapp-messages/messageLogsApi.ts`, `useMessageLogs.ts` — paginated list, filter by client, date range, status

### Pages and components
- [ ] `MessageTemplatesPage.tsx` — list templates, create/edit form (`name`, `content`), an "activate" action per template (admin only)
- [ ] Message history view — either a dedicated page or a tab on `ClientDetailPage.tsx` — showing `message_logs` for that client (content, status, sent date)
- [ ] Admin-only pause/resume control for the reminder cron, calling `POST /whatsapp/cron/pause` / `resume`
- [ ] Manual "send now" action on `ClientDetailPage.tsx`, calling `POST /whatsapp/clients/:clientId/send-reminder`

## Definition of done for this phase

- An admin can view, create, edit, and activate message templates through the panel
- A client's message history is visible on their detail page
- An admin can manually trigger a reminder for a specific client and pause/resume the scheduled job
- All items in `docs/DEFINITION_OF_DONE.md` checklist pass

## Do not build in this phase

Refinancing UI — that's Phase 6. Dashboard UI — that's Phase 7. Support for message *types* beyond the single overdue reminder — that's Phase 9, alongside the `api` side.

## Related documents

- `docs/phases/PHASE_5_WHATSAPP.md` — the `api` counterpart and the confirmed message format
