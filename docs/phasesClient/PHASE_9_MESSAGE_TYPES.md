# Phase 9 — Additional WhatsApp Message Types (Client)

## Goal
Extend the Phase 5 template/message UI to support all four message types confirmed against real client examples: the existing overdue reminder, plus new loan ("Primera vez"), upcoming due ("Aviso"), and account summary ("Estado de cuenta"). Mirrors `docs/phases/PHASE_9_MESSAGE_TYPES.md` — read that document first, since it defines the judgment calls this UI must reflect.

## Required reading before starting
`docs/phases/PHASE_9_MESSAGE_TYPES.md` (the `api` counterpart this phase consumes), `docs/GLOSSARY.md` (the four message-type definitions), `docs/DATABASE.md` (updated `message_templates`/`message_logs`/`loans` schema — **read the "Changed after Phase 9" section specifically**, it overrides the "Message templates" scope below).

## Scope

### Message templates — corrected to read-only (see `docs/DATABASE.md` "Changed after Phase 9")

The bullets originally here (a `type` selector on an editable template form, per-type "activate") assumed `message_templates` stayed admin-editable through Phase 9, the way it was in Phase 5. That's no longer true: WhatsApp only lets a business *initiate* a conversation outside an open 24h window through a template Meta has pre-approved, so a freely-editable `content` column doesn't reflect reality — editing it without a matching Meta approval would just break sending. Migration `1784300000000-MakeMessageTemplatesStatic.ts` removed the create/update/activate/delete endpoints; `MessageTemplatesController` now only exposes `GET /message-templates`, and there's exactly one row per `type` (no `is_active` to toggle — a type either has its one canonical row or it doesn't).

Corrected scope:
- [ ] `MessageTemplatesPage.tsx` becomes a **read-only** view of the 4 fixed templates (one card/row per `type`: `new_loan`, `upcoming_due`, `overdue`, `account_summary`), showing each one's current `name` and `content` — so the admin can see exactly what's being sent per type, with no edit/create/activate/delete affordances anywhere in the UI (they'd have nothing to call — those endpoints don't exist)
- [ ] Remove `MessageTemplateForm.tsx`, `DeleteTemplateDialog.tsx`, and `ActivateTemplateDialog.tsx` (all Phase-5-era, all now dead weight — the API they called no longer exists) and any "Nueva plantilla"/"Editar"/"Activar"/"Eliminar" buttons wired to them
- [ ] If a future template's copy needs to change, that's out of scope for the UI entirely — it happens via a new migration once Meta approves the new wording (see `docs/DATABASE.md`), not through this page
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

- All four message types' current canonical content is viewable (read-only) through the templates page
- Message history can be filtered by type
- A new loan's automatic confirmation message (sent or failed) is visible from the loan's detail page
- The upcoming-due reminder can be paused/resumed and manually triggered; the account summary can be sent on demand
- All items in `docs/DEFINITION_OF_DONE.md` checklist pass

## Related documents

- `docs/phases/PHASE_9_MESSAGE_TYPES.md` — the `api` counterpart and the scope decisions this UI must match
- `docs/DATABASE.md` — updated schema for `message_templates`, `message_logs`, `loans`
- `docs/GLOSSARY.md` — definitions of the four message types
