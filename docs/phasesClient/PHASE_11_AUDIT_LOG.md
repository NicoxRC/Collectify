# Phase 11 — Audit Logging (Client)

## Goal

Give admins a read-only screen to see who did what across the system. Mirrors `docs/phases/PHASE_11_AUDIT_LOG.md`.

## Required reading before starting

`docs/phases/PHASE_11_AUDIT_LOG.md` (the `api` counterpart this phase consumes).

## Scope

### Data layer
- [ ] `auditLogsApi.ts` — `getAll(query)` calling `GET /audit-logs`, same shape as `messageLogsApi.ts`.
- [ ] `useAuditLogs.ts` hook (TanStack Query), mirroring `useMessageLogs.ts`.

### Pages and components
- [ ] `features/auditLogs/AuditLogsPage.tsx` — reuse the exact skeleton of `MessageLogsPage.tsx`: filters (actor, action/entity type, date range Desde/Hasta), paginated table (Actor / Acción / Entidad / Fecha), row click opens a detail drawer.
- [ ] `AuditLogDrawer.tsx` — mirrors `MessageLogDrawer.tsx`, shows the full `metadata` payload for the selected entry.
- [ ] New route `/auditoria`, wrapped in `RequireRole allowedRoles={['admin']}`, same pattern as `/plantillas`.
- [ ] Sidebar nav entry, admin only.

## Definition of done for this phase

- An admin can filter and browse the full audit trail without needing direct API/database access.
- All items in `docs/DEFINITION_OF_DONE.md` checklist pass.

## Related documents

- `docs/phases/PHASE_11_AUDIT_LOG.md` — the `api` counterpart
