# Phase 22 — Interactive Templates and Inbound WhatsApp Webhook (Client)

## Goal

Give the admin visibility into inbound WhatsApp traffic — button taps and free-text messages clients send in — and a way to manage whatever button-flow ("menu") catalog the backend ends up exposing. See `docs/phases/PHASE_22_WHATSAPP_WEBHOOK.md` for the backend model this consumes; **this is the highest-priority phase in this round**.

## Status

**Partially blocked on the same open questions as the backend doc.** The inbound-message log view below is safe to build now (it only depends on the not-blocked backend scope); the button-flow/"menu" management UI and any preference/opt-out UI are blocked until those open questions are resolved — see `docs/phases/PHASE_22_WHATSAPP_WEBHOOK.md`'s "Open questions" section.

## Scope

### Not blocked

- [x] An inbound-message inbox (admin-only, `/mensajes-entrantes`): `WhatsappInboundMessagesPage.tsx`. Built as a **conversation inbox** (one entry per contact — matched client, or the raw phone number when unrecognized — opened into a chat-style thread), not a flat table, matching the standard pattern for this kind of screen (WhatsApp itself, Intercom, Chatwoot) — redesigned from an initial flat-table version at the human's explicit request (2026-08-27). Grouping is client-side over a single fetch, not a dedicated backend aggregation endpoint — reasonable at today's volume; revisit if that stops being true.
- [x] **Live updates via WebSocket** — `useWhatsappInboundSocket.ts` connects to `WhatsappInboundGateway` (`whatsapp-inbound` namespace, admin-only) and invalidates the query on every push, so a new message appears with no manual refresh. Built ahead of the menu catalog, at the human's explicit request (2026-08-27), as infrastructure the eventual human-handoff/live-reply flow will also need — see the note below.
- [ ] Surface a clear indicator on a client's profile/message history when they've sent something in that hasn't been followed up on yet (exact notification mechanism per the backend's open "admin notification" question — start with "visible in this log" as the floor, extend once that's resolved).

### Noted for later — not yet scoped, not yet built

Discussed with the human (2026-08-27) alongside the live-inbox work above, but deliberately not built yet — this is a bigger feature than a UI tweak and needs its own scoping pass once the menu catalog open questions are resolved:

- **Bot-first, human-escalation flow**: once the button-flow/"menu" catalog can auto-answer, an option (or an unprompted message the bot can't resolve) should be able to flag a conversation as needing a human, surfaced as a queue an admin/collector can "claim."
- **Live reply from the panel**: once a conversation is claimed, the agent needs a reply box sending free-form session messages (valid within the 24h window the client's own message opened) — the inbox above is still read-only.
- The `WhatsappInboundGateway`/Socket.IO infrastructure built in this pass is intended to be reused for this, not replaced.

### Blocked on backend open questions
- [ ] Button-flow/"menu" catalog management UI (shape depends entirely on the single-level-vs-multi-step decision).
- [ ] Any UI for a client's messaging preference/opt-out state.
- [ ] Any UI around automated replies to unprompted free-text messages.
- [ ] The bot-first/human-escalation flow noted above.

### Blocked on backend open questions
- [ ] Button-flow/"menu" catalog management UI (shape depends entirely on the single-level-vs-multi-step decision).
- [ ] Any UI for a client's messaging preference/opt-out state.
- [ ] Any UI around automated replies to unprompted free-text messages.

### Tests (per `docs/TESTING.md` conventions for this app)
- [ ] Inbound-message log view renders correctly for a message matched to a known client and one from an unrecognized number.

## Definition of done for this phase

- An admin can see every inbound WhatsApp message (button tap or free text) in the panel, with no message invisible.
- New messages appear live, without a manual refresh.
- Nothing was built ahead of the backend's open questions — the bot-first/human-escalation flow noted above stays a note, not code, until it's actually scoped.
- All items in `docs/DEFINITION_OF_DONE.md` checklist pass.

## Related documents

- `docs/phases/PHASE_22_WHATSAPP_WEBHOOK.md` — backend model this phase consumes, including the open questions gating the rest of this phase's scope
