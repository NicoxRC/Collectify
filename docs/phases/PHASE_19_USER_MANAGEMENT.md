# Phase 19 — User Management UI

## Goal

Document that the backend for company user management is already complete, so this phase is scoped purely as a checkpoint before the client-side work in `docs/phasesClient/PHASE_19_USER_MANAGEMENT.md`. This phase formalizes the "User management UI" item already listed as candidate scope in `docs/phasesClient/PHASE_8_POLISH.md`, separated out here because the client-side work is low-risk and shouldn't wait on the larger, higher-uncertainty permissions matrix in `docs/phases/PHASE_20_MODULE_PERMISSIONS.md`.

## Scope

### Backend — already built, nothing new required
- [ ] Confirm `UsersController`/`UsersService` fully cover: `GET /api/v1/users` (list, filterable by `isActive`), `POST /api/v1/users` (create, admin only), `PATCH /api/v1/users/:id/deactivate`, `PATCH /api/v1/users/:id/reactivate` — all already implemented per Phase 2.
- [ ] Fill in any missing Swagger documentation on these existing endpoints if gaps are found.

### Tests
- [ ] Confirm existing test coverage for `UsersService`/`UsersController` meets `docs/TESTING.md`'s bar; add any missing cases found during this review (e.g. an admin cannot deactivate their own account, already documented as intended behavior).

## Definition of done for this phase

- No backend gaps remain between what `docs/phasesClient/PHASE_19_USER_MANAGEMENT.md` needs and what the API already exposes.
- All items in `docs/DEFINITION_OF_DONE.md` checklist pass.

## Related documents

- `docs/phases/PHASE_2_AUTH.md` — where `UsersController`/`UsersService` were originally built
- `docs/phasesClient/PHASE_8_POLISH.md` — where this item was originally listed as candidate scope
- `docs/phasesClient/PHASE_19_USER_MANAGEMENT.md` — the client counterpart, where the actual new work in this phase lives
