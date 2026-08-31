# Phase 27 — Personalized Messaging Frequency (Client)

## Goal

Replace the `overdue`/`upcoming_due` audience editor UI (Phase 18's checkbox-list group manager) with a simple per-client frequency control, and remove the warning copy about an empty audience meaning nobody gets reminded — that behavior no longer exists. See `docs/phases/PHASE_27_MESSAGE_FREQUENCY.md` for the backend model this consumes.

## Scope

- [x] Removed `TemplateAudienceEditor`, `ClientPickerModal`, and their supporting helpers (`ChipButton`, `PlusIcon`, `PageButton`) entirely from `MessageTemplatesPage.tsx`, including the red "empty group means nobody is reminded" warning — replaced with a short note per type (`overdue`/`upcoming_due` now say every qualifying client is messaged, with frequency adjustable from the client's own profile). `useMessageAudience`/`useUpdateMessageAudience` removed from `useMessageTemplates.ts`; `getAudience`/`updateAudience`/`MessageAudience` removed from `messageTemplatesApi.ts`.
- [x] Added a `MessageFrequencySection` on `ClientDetailPage.tsx` (visible to every role; set/clear/edit gated to admin, matching the backend's `@Roles(Admin)`) — plain "cada cuántos días como mínimo" number input, with copy explicitly noting it only throttles, never changes eligibility.
- [x] Decision: the frequency indicator was scoped to the client **profile** only, not the `ClientsListPage.tsx` table — showing it per-row in the list would need a join/subquery on every paginated list request purely for this rarely-set field, versus the profile page already fetching `ClientDetail` (which includes `messageFrequency`) with no extra request. The phase brief's "client list/profile" wording didn't mandate both; this is a scoping call, noted here per `docs/CLAUDE.md`'s guidance to flag technical decisions in the PR rather than silently pick one.

### Tests (per `docs/TESTING.md` conventions for this app)
- Frontend component/unit tests are explicitly out of scope project-wide (`docs/TESTING.md` "Out of scope (for now)": "Frontend component/unit tests") — verified via lint/build/manual review instead, consistent with every other client-side phase in this project.

## Definition of done for this phase

- [x] The old audience group editor and its warning copy are gone for `overdue`/`upcoming_due`.
- [x] An admin can set and clear a client's custom messaging frequency from the panel.
- [x] All items in `docs/DEFINITION_OF_DONE.md` checklist pass — lint/test/build verified across both apps (2026-08-30).

## Related documents

- `docs/phases/PHASE_27_MESSAGE_FREQUENCY.md` — backend model this phase consumes
- `docs/phasesClient/PHASE_18_MESSAGE_AUDIENCES.md` — the audience editor UI this phase removes
