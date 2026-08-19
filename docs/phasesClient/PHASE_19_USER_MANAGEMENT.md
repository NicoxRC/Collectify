# Phase 19 — User Management UI (Client)

## Goal

Build the admin panel for managing company (collector/admin) user accounts — creating them, deactivating, and reactivating — that has never had a frontend despite the backend supporting it fully since Phase 2. This resolves the "User management UI" item listed as candidate scope in `docs/phasesClient/PHASE_8_POLISH.md`; that document is not being rewritten, this phase formally picks up that item. Mirrors `docs/phases/PHASE_19_USER_MANAGEMENT.md`.

## Required reading before starting

`docs/phases/PHASE_19_USER_MANAGEMENT.md` (the `api` counterpart, confirming the backend is ready), `docs/phasesClient/PHASE_8_POLISH.md` (where this item originates).

## Scope

### Data layer
- [x] `usersApi.ts` — `getAll(query)`, `create(dto)`, `deactivate(id)`, `reactivate(id)`, matching the existing `UsersController` endpoints.
- [x] `useUsers.ts` hooks (TanStack Query), mirroring `useClients.ts`.

### Pages and components
- [x] `features/users/UsersListPage.tsx` — list with Activos/Inactivos tabs, closely mirroring `ClientsListPage.tsx`. No search or pagination controls: `QueryUsersDto` only supports `isActive`, and a company user list is expected to stay small.
- [x] `UserForm.tsx` — create dialog (name, email, role, password), mirroring `ClientForm.tsx`'s structure. Create-only, unlike `ClientForm.tsx` — the backend has no `PATCH /users/:id` to edit an existing account, only deactivate/reactivate.
- [x] `UserRow.tsx` — deactivate/reactivate row actions, mirroring `ClientRow.tsx`. The logged-in admin's own row shows "Tu cuenta" instead of a Desactivar action (client-side mirror of `UsersService.deactivate`'s server-side "cannot deactivate your own account" rule, avoiding a guaranteed-400 request). A confirm dialog (`DeactivateUserDialog.tsx`, mirroring `DeactivateClientDialog.tsx`) gates the actual deactivation.
- [x] New route `/usuarios`, `RequireRole allowedRoles={['admin']}`, same pattern as `/plantillas`.
- [x] Sidebar nav entry ("Usuarios"), admin only.

## Definition of done for this phase

- [x] An admin can create, deactivate, and reactivate collector/admin accounts entirely through the panel, with no direct API access needed.
- [x] All items in `docs/DEFINITION_OF_DONE.md` checklist pass.

## Related documents

- `docs/phases/PHASE_19_USER_MANAGEMENT.md` — the `api` counterpart
- `docs/phasesClient/PHASE_8_POLISH.md` — where this item was originally deferred
- `docs/phasesClient/PHASE_20_MODULE_PERMISSIONS.md` — the follow-up phase that adds granular permissions on top of this panel
