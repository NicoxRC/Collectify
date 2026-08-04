# Phase 20 — Module Permissions Matrix (Client)

## Goal

Let an admin toggle which modules each employee can see, and hide navigation/routes accordingly. Mirrors `docs/phases/PHASE_20_MODULE_PERMISSIONS.md` — **read that document's "Before starting" section first**, since the shape of the permissions UI depends entirely on how "módulo" and permission scope get defined there.

## Required reading before starting

`docs/phases/PHASE_20_MODULE_PERMISSIONS.md` (the `api` counterpart and its open questions), `docs/phasesClient/PHASE_19_USER_MANAGEMENT.md` (the user management panel this phase's permission UI attaches to).

## Scope

### Guard
- [ ] Extend `RequireRole.tsx` (or add `RequirePermission.tsx` alongside it) to check module-level access in addition to the existing role check.
- [ ] Audit every route gate in `router.tsx` currently keyed only on `allowedRoles`, migrating incrementally alongside the backend's incremental controller migration (Phase 20 backend doc) so client and server permission checks never drift out of sync for a given module.

### Permissions UI
- [ ] In the user management panel (`UsersListPage.tsx`/`UserForm.tsx` from Phase 19), add a checklist-style UI per user for which modules they can access.
- [ ] `Sidebar.tsx`: hide nav entries for modules the current user lacks permission to, in addition to the existing role-based hiding.

## Definition of done for this phase

- An admin can toggle module visibility per employee, and it's reflected in both navigation and route access.
- All items in `docs/DEFINITION_OF_DONE.md` checklist pass.

## Related documents

- `docs/phases/PHASE_20_MODULE_PERMISSIONS.md` — the `api` counterpart
- `docs/phasesClient/PHASE_19_USER_MANAGEMENT.md` — the panel this phase's UI attaches to
