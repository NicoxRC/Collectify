# Phase 20 — Module Permissions Matrix (Client)

## Goal

Let an admin toggle which modules each employee can see, and hide navigation/routes accordingly. Mirrors `docs/phases/PHASE_20_MODULE_PERMISSIONS.md` — **read that document's "Before starting" section first**, since the shape of the permissions UI depends entirely on how "módulo" and permission scope get defined there.

## Required reading before starting

`docs/phases/PHASE_20_MODULE_PERMISSIONS.md` (the `api` counterpart, its confirmed answers under "Before starting", and which controllers have migrated so far), `docs/phasesClient/PHASE_19_USER_MANAGEMENT.md` (the user management panel this phase's permission UI attaches to).

## Scope

### Guard
- [x] `RequirePermission.tsx` added alongside `RequireRole.tsx` (not a replacement) — checks `user.role === 'admin' || user.modules.includes(module)`, mirroring `ModulePermissionsGuard` exactly.
- [x] `router.tsx`'s `plantillas` route migrated to `RequirePermission module="message_templates"`, matching `MessageTemplatesController`'s backend migration. Every other route gate (`conceptos-de-interes`, `auditoria`, `tasa-de-usura`, `usuarios`) is **still on `RequireRole allowedRoles={['admin']}`** — intentionally, matching the backend's incremental migration. Migrate each here in the same follow-up as its backend controller, never ahead of it (client and server would drift out of sync for that module otherwise).

### Permissions UI
- [x] `UserForm.tsx` (Phase 19, create-only) — when the selected role is `collector`, shows `ModuleChecklist` for the new account's initial modules. Submitted via a separate `PUT /users/:id/permissions` call right after the account itself is created (same two-step pattern as `ClientForm.tsx`'s reference sync), only when at least one module was checked.
- [x] `UserPermissionsDialog.tsx` (new) — edits an *existing* collector's modules, opened via a "Permisos" row action in `UserRow.tsx` (shown only for an active collector row; an admin has full access unconditionally, so there's nothing to edit for one).
- [x] `ModuleChecklist.tsx` (new, shared) — the actual 8-checkbox grid, reused by both of the above.
- [x] `Sidebar.tsx`: `NavItem` gained an optional `module` field alongside the existing `roles` field. `Plantillas` uses `module: 'message_templates'` now; every other admin-only item is still on `roles: ['admin']`, matching the guard migration state above exactly.

## Definition of done for this phase

- [x] An admin can toggle module visibility per employee (at creation and afterward), and it's reflected in both navigation and route access — verified end-to-end in a real browser: created a collector with only `message_templates` granted, confirmed the sidebar and `/plantillas` route allowed it while `/usuarios` and `/conceptos-de-interes` (both still role-gated) correctly redirected.
- [x] All items in `docs/DEFINITION_OF_DONE.md` checklist pass.

## Related documents

- `docs/phases/PHASE_20_MODULE_PERMISSIONS.md` — the `api` counterpart, including which controllers have migrated so far
- `docs/phasesClient/PHASE_19_USER_MANAGEMENT.md` — the panel this phase's UI attaches to
