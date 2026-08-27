# Phase 26 — Personalized Messaging Frequency (Client)

## Goal

Replace the `overdue`/`upcoming_due` audience editor UI (Phase 18's checkbox-list group manager) with a simple per-client frequency control, and remove the warning copy about an empty audience meaning nobody gets reminded — that behavior no longer exists. See `docs/phases/PHASE_26_MESSAGE_FREQUENCY.md` for the backend model this consumes.

## Scope

- [ ] Remove `TemplateAudienceEditor` (or its `overdue`/`upcoming_due` usage) from `MessageTemplatesPage.tsx`, including the red "empty group means nobody is reminded" warning — no longer true once the change ships.
- [ ] Add a frequency control somewhere reachable from a client's profile (or a dedicated small admin screen) to set/clear their `minimum_days_between_messages` — plain "cada cuántos días como mínimo" input, clear on how it differs from the underlying cron schedule (this only throttles, it never adds eligibility).
- [ ] Client list/profile shows whether a client currently has a custom frequency set, so it isn't invisible state.

### Tests (per `docs/TESTING.md` conventions for this app)
- [ ] Setting/clearing a client's frequency override persists and reflects correctly.
- [ ] `TemplateAudienceEditor` (or equivalent) no longer renders for `overdue`/`upcoming_due`.

## Definition of done for this phase

- The old audience group editor and its warning copy are gone for `overdue`/`upcoming_due`.
- An admin can set and clear a client's custom messaging frequency from the panel.
- All items in `docs/DEFINITION_OF_DONE.md` checklist pass.

## Related documents

- `docs/phases/PHASE_26_MESSAGE_FREQUENCY.md` — backend model this phase consumes
- `docs/phasesClient/PHASE_18_MESSAGE_AUDIENCES.md` — the audience editor UI this phase removes
