# Phase 10 — Client Capacity (Cupo) and Reactivation (Client)

## Goal

Surface a client's credit limit, used/available cupo, and mora-block status in the panel, and let admins reactivate a soft-deleted client instead of hitting a dead end. Mirrors `docs/phases/PHASE_10_CLIENT_CAPACITY.md` — read that document first, since the business rules for cupo usage and mora-block scope must be confirmed there before this UI can be built correctly.

## Required reading before starting

`docs/phases/PHASE_10_CLIENT_CAPACITY.md` (the `api` counterpart this phase consumes, including its "Before starting" open questions), `docs/GLOSSARY.md`, `docs/DATABASE.md`.

## Scope

### Client form
- [ ] `ClientForm.tsx`: add a "Cupo" currency field (optional — unset means no limit enforced, matching the `api`'s nullable `creditLimit`).

### Client detail page
- [ ] `ClientDetailPage.tsx`: replace the hardcoded `Activo` badge (confirmed currently hardcoded, not computed from real client state) with a real cupo section — "Cupo usado: $X de $Y disponibles" — and a distinct, visually obvious mora-block indicator when `isMoraBlocked` is true.
- [ ] Wherever this client's "create loan" entry point lives, disable it (with a tooltip explaining why — over cupo vs. mora-blocked are different reasons and should say so) when the client is blocked by either rule, matching the `api`'s two distinct rejection reasons.

### Client list
- [ ] `ClientRow.tsx`: replace the `Sin acciones disponibles` shown for inactive rows with a `Reactivar` row action (admin only).
- [ ] `useClients.ts`: add `useReactivateClient()`, mirroring the existing `useDeleteClient()` hook exactly.
- [ ] `ClientsListPage.tsx` "Inactivos" tab: confirm the reactivated client moves back to the "Activos" tab after the mutation succeeds (query invalidation, same pattern already used for `useDeleteClient()`).

### Loan creation
- [ ] `LoanForm.tsx`: once a client is selected, surface their available cupo and mora-block status inline, before the admin fills in loan terms — don't let them discover the rejection only after submitting.

## Definition of done for this phase

- A client's cupo usage and mora-block status are visible on their profile, matching what the `api` computes.
- An inactive client can be reactivated from the client list without needing direct API access.
- Attempting to create a loan for a blocked client is prevented in the UI with a clear, correct-reason message before the request is even sent.
- All items in `docs/DEFINITION_OF_DONE.md` checklist pass.

## Related documents

- `docs/phases/PHASE_10_CLIENT_CAPACITY.md` — the `api` counterpart and its open questions this UI must reflect once resolved
- `docs/DATABASE.md` — updated `clients` schema
- `docs/GLOSSARY.md` — cupo definition
