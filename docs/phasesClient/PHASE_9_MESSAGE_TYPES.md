# Phase 9 — Additional WhatsApp Message Types (Client)

## Goal
Extend the Phase 5 template/message UI to support all four message types confirmed against real client examples: the existing overdue reminder, plus new loan ("Primera vez"), upcoming due ("Aviso"), and account summary ("Estado de cuenta"). Mirrors `docs/phases/PHASE_9_MESSAGE_TYPES.md` — read that document first, since it defines the judgment calls this UI must reflect.

## Required reading before starting
`docs/phases/PHASE_9_MESSAGE_TYPES.md` (the `api` counterpart this phase consumes), `docs/GLOSSARY.md` (the four message-type definitions), `docs/DATABASE.md` (updated `message_templates`/`message_logs`/`loans` schema).

## Scope

### Message templates
- [ ] `MessageTemplateForm.tsx` gains a `type` selector (`new_loan`, `upcoming_due`, `overdue`, `account_summary`)
- [ ] `MessageTemplatesPage.tsx` list is filterable/grouped by type; the "activate" action is understood by the admin to apply **per type** (activating a `new_loan` template doesn't deactivate the active `overdue` one) — make this scoping visible in the UI, not just correct on the backend
- [ ] Message log list/filter (from Phase 5) gains a `type` column and filter

### New loan message ("Primera vez")
- [ ] No manual trigger needed — it's sent automatically by the `api` at loan creation/refinance time
- [ ] `LoanDetailPage.tsx` surfaces whether/when it was sent, by reading the client's message log filtered to this loan/type, so a failed send (logged, non-blocking per the `api`'s design) is visible to the admin rather than silent
- [ ] `LoanForm.tsx` (from Phase 4) gains the optional `description` field ("por concepto de X")

### Upcoming due reminder ("Aviso")
- [ ] Admin-only pause/resume control, mirroring the overdue reminder's, calling the Phase 9 `api` endpoints
- [ ] Manual "send now" trigger on `ClientDetailPage.tsx`

### Account summary ("Estado de cuenta")
- [ ] On-demand "send account summary" button on `ClientDetailPage.tsx`, admin only, calling `POST /whatsapp/clients/:clientId/send-account-summary` — no schedule/pause-resume control needed, since this type has no cron

## Definition of done for this phase

- All four message types are viewable, editable, and independently activatable per type through the templates UI
- Message history can be filtered by type
- A new loan's automatic confirmation message (sent or failed) is visible from the loan's detail page
- The upcoming-due reminder can be paused/resumed and manually triggered; the account summary can be sent on demand
- All items in `docs/DEFINITION_OF_DONE.md` checklist pass

## Related documents

- `docs/phases/PHASE_9_MESSAGE_TYPES.md` — the `api` counterpart and the scope decisions this UI must match
- `docs/DATABASE.md` — updated schema for `message_templates`, `message_logs`, `loans`
- `docs/GLOSSARY.md` — definitions of the four message types
