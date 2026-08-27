# Phase 22 — Interactive Templates and Inbound WhatsApp Webhook (Client)

## Goal

Give the admin visibility into inbound WhatsApp traffic — button taps and free-text messages clients send in — and a way to manage whatever button-flow ("menu") catalog the backend ends up exposing. See `docs/phases/PHASE_22_WHATSAPP_WEBHOOK.md` for the backend model this consumes; **this is the highest-priority phase in this round**.

## Status

**Partially blocked on the same open questions as the backend doc.** The inbound-message log view below is safe to build now (it only depends on the not-blocked backend scope); the button-flow/"menu" management UI and any preference/opt-out UI are blocked until those open questions are resolved — see `docs/phases/PHASE_22_WHATSAPP_WEBHOOK.md`'s "Open questions" section.

## Scope

### Not blocked

- [ ] An inbound-message log view (admin-only, likely under the existing Mensajes/WhatsApp section): lists `WhatsappInboundMessage` rows — sender, matched client (or "número no reconocido"), type (button/text), content, received time. This is the minimum viewer needed so an admin isn't blind to what's arriving, independent of how automated the response ends up being.
- [ ] Surface a clear indicator on a client's profile/message history when they've sent something in that hasn't been followed up on yet (exact notification mechanism per the backend's open "admin notification" question — start with "visible in this log" as the floor, extend once that's resolved).

### Blocked on backend open questions
- [ ] Button-flow/"menu" catalog management UI (shape depends entirely on the single-level-vs-multi-step decision).
- [ ] Any UI for a client's messaging preference/opt-out state.
- [ ] Any UI around automated replies to unprompted free-text messages.

### Tests (per `docs/TESTING.md` conventions for this app)
- [ ] Inbound-message log view renders correctly for a message matched to a known client and one from an unrecognized number.

## Definition of done for this phase

- An admin can see every inbound WhatsApp message (button tap or free text) in the panel, with no message invisible.
- Nothing was built ahead of the backend's open questions.
- All items in `docs/DEFINITION_OF_DONE.md` checklist pass.

## Related documents

- `docs/phases/PHASE_22_WHATSAPP_WEBHOOK.md` — backend model this phase consumes, including the open questions gating the rest of this phase's scope
