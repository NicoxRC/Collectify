# Phase 19 — User Management UI

**Status: backend confirmed complete (2026-08-18).** The remaining work for this phase is the frontend, tracked in `docs/phasesClient/PHASE_19_USER_MANAGEMENT.md`.

## Goal

Document that the backend for company user management is already complete, so this phase is scoped purely as a checkpoint before the client-side work in `docs/phasesClient/PHASE_19_USER_MANAGEMENT.md`. This phase formalizes the "User management UI" item already listed as candidate scope in `docs/phasesClient/PHASE_8_POLISH.md`, separated out here because the client-side work is low-risk and shouldn't wait on the larger, higher-uncertainty permissions matrix in `docs/phases/PHASE_20_MODULE_PERMISSIONS.md`.

## Scope

### Backend — already built, nothing new required
- [x] Confirm `UsersController`/`UsersService` fully cover: `GET /api/v1/users` (list, filterable by `isActive`), `POST /api/v1/users` (create, admin only), `PATCH /api/v1/users/:id/deactivate`, `PATCH /api/v1/users/:id/reactivate` — all already implemented per Phase 2. Confirmed: all four endpoints exist, admin-only via `@Roles(UserRole.Admin)`.
- [x] Fill in any missing Swagger documentation on these existing endpoints if gaps are found. Confirmed: no gaps — `@ApiTags`/`@ApiBearerAuth`/`@ApiOperation`/`@ApiResponse` on the controller, `@ApiProperty`/`@ApiPropertyOptional` on `CreateUserDto` and `QueryUsersDto`.

### Tests
- [x] Confirm existing test coverage for `UsersService`/`UsersController` meets `docs/TESTING.md`'s bar; add any missing cases found during this review (e.g. an admin cannot deactivate their own account, already documented as intended behavior). Confirmed: `users.service.spec.ts` covers the happy path, edge cases, and error cases for every method, including the "cannot deactivate own account" case.

## Definition of done for this phase

- [x] No backend gaps remain between what `docs/phasesClient/PHASE_19_USER_MANAGEMENT.md` needs and what the API already exposes.
- [x] All items in `docs/DEFINITION_OF_DONE.md` checklist pass.

## Related documents

- `docs/phases/PHASE_2_AUTH.md` — where `UsersController`/`UsersService` were originally built
- `docs/phasesClient/PHASE_8_POLISH.md` — where this item was originally listed as candidate scope
- `docs/phasesClient/PHASE_19_USER_MANAGEMENT.md` — the client counterpart, where the actual new work in this phase lives
