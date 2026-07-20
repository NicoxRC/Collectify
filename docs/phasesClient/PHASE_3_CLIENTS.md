# Phase 3 — Clients (Client)

## Goal
Full client management through the panel — this is the UI half of what replaces the client-tracking part of the Excel process. Mirrors `docs/phases/PHASE_3_CLIENTS.md`.

## Reference
`docs/DATABASE.md` → `clients` table. `docs/GLOSSARY.md` → Client definition.

## Scope

### Data layer
- [ ] `features/clients/clientsApi.ts` — `getAll` (paginated, search, active/inactive filter), `getOne`, `create`, `update`, `remove`
- [ ] `features/clients/useClients.ts` — TanStack Query hooks: `useClients(params)`, `useClient(id)`, `useCreateClient`, `useUpdateClient`, `useDeleteClient`, with cache invalidation on mutation success

### Pages and components
- [ ] `ClientsListPage.tsx` — table with search (name/document/phone), active/inactive filter, pagination controls, "new client" action (admin only)
- [ ] `ClientForm.tsx` — create/edit form: `firstName`, `lastName`, `documentNumber`, `phoneNumber`; client-side validation mirroring the API DTOs (E.164 phone format, required non-empty document number) so obvious errors are caught before hitting the API
- [ ] `ClientDetailPage.tsx` — the client's own fields for now (their loans are added in Phase 4)
- [ ] Inline display of API validation errors on the form — in particular, a duplicate `documentNumber` must show a clear field-level error, not a raw failure message

### Role-based access
- [ ] Create/edit/delete actions restricted to `admin` in the UI — hidden or disabled for `collector`, consistent with the guard behavior from Phase 2

## Definition of done for this phase

- A client can be listed, searched, created, edited, and soft-deleted entirely through the panel
- Submitting a duplicate `documentNumber` shows a clear inline error next to the field
- All items in `docs/DEFINITION_OF_DONE.md` checklist pass

## Out of scope for this phase

Excel import (bulk client onboarding) is deferred to Phase 8, per `docs/PROJECT_ROADMAP.md` — same as the `api` side.

## Related documents

- `docs/phases/PHASE_3_CLIENTS.md` — the `api` counterpart and its DTO contract
