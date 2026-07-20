# Phase 8 — Polish and Secondary Features (Client)

## Goal
Secondary features and refinements identified once the core panel is in real use. Per `docs/PROJECT_ROADMAP.md`, this phase has no fixed scope the way Phases 1–7 do — it's driven by what's actually still needed once the core system is in production, and by real usage feedback from the client. The `api` side of this phase doesn't have a dedicated phase document either, for the same reason; this file exists on the client side because the roadmap's Phase 8 items are mostly UI-shaped.

## Candidate scope (confirm against actual need before building)

- [ ] Excel import UI — upload flow for bulk client onboarding, only if still needed once manual entry (Phase 3) has been used for a while; calls the corresponding `api` import endpoint
- [ ] User management UI — list, create, and deactivate `admin`/`collector` accounts (admin only); the `api`'s Phase 2 notes that a `POST /users` endpoint may have been deferred to this phase — confirm it exists before building this
- [ ] General UI/UX refinement backlog based on real usage feedback from the client — table density, mobile responsiveness, empty states, loading states, error messaging consistency across features

## Definition of done for this phase

There's no fixed exit criteria here, unlike earlier phases — done means whatever concrete items were actually pulled from the backlog for this pass are shipped and meet the standard checklist in `docs/DEFINITION_OF_DONE.md`.

## Related documents

- `docs/PROJECT_ROADMAP.md` — Phase 8 description
- `docs/phases/PHASE_3_CLIENTS.md` — where Excel import was originally deferred from
