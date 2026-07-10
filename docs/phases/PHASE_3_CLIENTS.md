# Phase 3 — Clients (Backend)

## Goal
Full CRUD for clients (the company's debtors) — this replaces the client-tracking part of the Excel process.

## Reference
`docs/DATABASE.md` → `clients` table. `docs/GLOSSARY.md` → Client definition.

## Scope

### Entity and migration
- [ ] `Client` entity: `id`, `first_name`, `last_name`, `document_number`, `phone_number`, standard timestamps + soft delete
- [ ] Migration for the `clients` table
- [ ] Index on `document_number` and `phone_number` (see `docs/DATABASE.md` → Indexes)
- [ ] Unique constraint on `document_number` — two clients can't share the same national ID

### Endpoints
- [ ] `GET /api/v1/clients` — paginated list, with search by name/document/phone, filter by active/inactive
- [ ] `GET /api/v1/clients/:id` — detail (will later include their loans, once Phase 4 exists — for now just the client's own fields)
- [ ] `POST /api/v1/clients` — admin only
- [ ] `PATCH /api/v1/clients/:id` — admin only
- [ ] `DELETE /api/v1/clients/:id` — soft delete, admin only

### DTOs
- [ ] `CreateClientDto`, `UpdateClientDto` — validate `phone_number` format (Colombian, E.164), `document_number` as required non-empty string

### Tests (mandatory)
- [ ] `ClientsService`: create, find one (found / not found), update (found / not found), soft delete, list with search/filter, duplicate `document_number` rejected

### Swagger
- [ ] All endpoints documented

## Definition of done for this phase

- A client can be created, edited, searched by name/document/phone, and soft-deleted through the API
- Attempting to create a client with a duplicate `document_number` returns a clear validation error, not a raw database constraint error
- All items in `docs/DEFINITION_OF_DONE.md` checklist pass

## Notes

- Excel import (bulk client onboarding) is explicitly deferred to Phase 8 per `docs/PROJECT_ROADMAP.md` — don't build it here even if it seems convenient to add now.
