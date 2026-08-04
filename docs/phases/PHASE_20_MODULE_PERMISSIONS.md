# Phase 20 — Module Permissions Matrix

## Goal

Go beyond the current binary `admin`/`collector` role to let an admin control, per employee, which modules of the panel they can see and use. This is the second, larger half of item 17 in the original request ("activar o desactivar los módulos que pueden o no ver los empleados") — split from `docs/phases/PHASE_19_USER_MANAGEMENT.md` because this half is an architecture change touching every protected endpoint, not just a UI addition on top of an already-complete backend.

## Before starting this phase — stop and confirm with the human

1. What exactly is a "módulo"? A fixed enum of app sections (Clientes, Préstamos, Mensajes, Plantillas, Auditoría, etc. — matching the sidebar's top-level items), or something more granular by route/action?
2. Are permissions assigned per individual user, per role with per-user exceptions, or purely per role (in which case this is really "more roles", not a permissions matrix)?

**Do not pick answers and build it — ask the human.** This changes the global `RolesGuard` used by every protected controller in the system — a wrong design here has to be unwound across the entire API surface, not just one module.

## Required reading before starting

`docs/ARCHITECTURE.md` (current `RolesGuard`/`@Roles()` mechanism), `docs/phases/PHASE_2_AUTH.md` (where the current binary role system was built), `docs/phases/PHASE_19_USER_MANAGEMENT.md` (the user management panel this phase's permissions attach to).

## Scope (once the above is confirmed)

### Entities and migrations
- [ ] `Permission` / `ModulePermission` entity — exact shape depends on the confirmed answer to question 1 above (e.g. `user_id`, `module` enum, `can_view` boolean, if per-user; or a `role_permissions` table if per-role).
- [ ] Migration for the new table(s).

### Guard and enforcement
- [ ] Migrate `@Roles()` usages **incrementally, one controller at a time** (starting with a low-risk one, e.g. `MessageTemplatesController`), not all at once — this guard runs on every protected endpoint in the system, so a broad simultaneous change is a broad simultaneous regression risk.
- [ ] `PermissionsGuard` (or an extension of the existing `RolesGuard`) checking module-level access in addition to the existing role check.

### Tests (mandatory)
- [ ] A user without permission to a module is rejected from every endpoint under it; a user with permission behaves exactly as before.
- [ ] Migrating one controller to the new guard does not change behavior for any endpoint not yet migrated.

### Swagger
- [ ] Updated to reflect the new permission requirements per endpoint as they're migrated.

## Definition of done for this phase

- An admin can control, per employee, which modules they can access.
- The confirmed permission model is implemented exactly as agreed — not guessed.
- Every previously `@Roles()`-protected endpoint has been migrated (no endpoint left checking only the old binary role with the new system half-applied elsewhere).
- All items in `docs/DEFINITION_OF_DONE.md` checklist pass.

## After this phase

Update `docs/GLOSSARY.md`'s "Roles" section (the existing "exact permission boundaries to be finalized during development" note on Collector/Cobrador is resolved by this phase) and `docs/DATABASE.md` with the new permission tables.

## Related documents

- `docs/phases/PHASE_2_AUTH.md` — the binary role system this phase extends
- `docs/phases/PHASE_19_USER_MANAGEMENT.md` — the panel this phase's permissions attach to
- `docs/GLOSSARY.md` — the open "permission boundaries" note this phase resolves
