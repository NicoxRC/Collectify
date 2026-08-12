# Phase 21 — Extended Client Profile (KYC)

## Goal

Capture significantly more information per client at signup — identification detail, contact/address data, employment info, personal and commercial references, and photo documentation (ID scan, selfie) — so the business has real collateral information on file for a lending relationship, not just enough to send a WhatsApp reminder. Requested directly by the client (see message excerpt below); not previously scoped in `docs/PROJECT_ROADMAP.md`.

> Client's own words: "hay que incluir la mayor cantidad de datos posible, incluido también un campo para fotografías del documento, carga de archivos en caso de que este escaneado y también foto selfie de la persona cuando este en el local. Direcciones, correos, números alternos, referencias comerciales o referencias personales, dirección de vivienda, dirección de trabajo... mientras mas información se recolecte hay mas seguridad."

## Before starting this phase — stop and confirm with the human

This phase is unusually open-ended for how much it touches the core `Client` entity and onboarding flow. **Do not guess at any of the below — confirm with the client before writing migrations.**

1. **Final field list.** The proposed list under "Scope" below is a starting point assembled from the client's message plus standard microcredit KYC practice (flagged inline as `[inferred, not explicitly requested]`). Needs an explicit yes/no per field, not an assumption that "more is better" applies to every candidate.
2. **References: how many, and what shape?** "Referencias personales" and "referencias comerciales" are inherently one-to-many (a client typically gives 2-3 personal references, 1-2 commercial) — this needs a new related table (`client_references`), not flat columns on `Client`. Confirm: minimum/maximum count enforced by the form, and what fields per reference (name + phone + relationship is the minimum; commercial references may also want a business name).
3. **Document photos: how many, and what exactly?** A cédula has a front and back — is one combined photo enough, or two separate uploads? Is the selfie a single photo, or does the business want it captured with a timestamp/liveness check (out of scope for now if so — flag explicitly if the client wants this later)?
4. **Where does the scanned pagaré photo belong?** The client mentioned this in the same breath as the ID/selfie, but a pagaré is generated per **loan**, not per client — a client can have several. This almost certainly belongs on `Loan`, not `Client`, as its own `image_url` (mirroring `Payment.imageUrl` from Phase 12), not bundled into this phase's client-profile fields. Confirm this reading is correct before scoping it into either this phase or a follow-up one.
5. **Employment/income fields — in scope or not?** The client didn't explicitly ask for occupation/employer/monthly income, but it's the single most standard piece of information missing for actual credit risk assessment. Worth asking directly: does the business already informally collect this before lending, and if so, do they want it captured in the system?
6. **Mandatory vs. optional at creation.** `docs/phases/PHASE_8_EXCEL_IMPORT.md` onboards clients in bulk with only the current minimal field set (name, document, phone). If most of this phase's new fields become required, bulk import either needs a matching update or these fields stay optional and get filled in later via the client's profile page. Confirm which.

## Required reading before starting

`docs/GLOSSARY.md`, `docs/DATABASE.md` (`clients` table), `docs/phases/PHASE_3_CLIENTS.md` (existing CRUD this phase extends), `docs/phases/PHASE_8_EXCEL_IMPORT.md` (bulk import this phase may affect), `docs/phases/PHASE_12_PAYMENT_ATTACHMENTS.md` (the image-hosting pattern this phase reuses as-is — same provider, same "api only stores the URL" rule, no new decision needed there).

## Scope (once the above is confirmed)

### `Client` entity — proposed new columns, all nullable unless noted
- [ ] `document_type` (ENUM: `cedula_ciudadania`, `cedula_extranjeria`, `pasaporte`) — currently only a bare `document_number` with no type.
- [ ] `date_of_birth` (DATE) `[inferred, not explicitly requested]`
- [ ] `document_issue_place` (VARCHAR) `[inferred, not explicitly requested]`
- [ ] `email` (VARCHAR)
- [ ] `alternate_phone_number` (VARCHAR)
- [ ] `home_address` (TEXT)
- [ ] `work_address` (TEXT)
- [ ] `neighborhood` / `city` — separate from the free-text address fields above, for collections field work `[inferred, not explicitly requested]`
- [ ] `occupation`, `employer_name`, `monthly_income` (DECIMAL) — only if confirmed in scope per open question 5 above `[inferred, not explicitly requested]`
- [ ] `id_document_image_url`, `selfie_image_url` (VARCHAR, nullable) — same externally-hosted-URL-only pattern as `Payment.imageUrl` (Phase 12); one column each unless open question 3 resolves to needing front/back as two images

### New entity: `client_references` (pending confirmation of open question 2)
- [ ] `ClientReference` entity: `id`, `client_id` (FK), `type` (`personal` | `comercial`), `full_name`, `phone_number`, `relationship` (free text, e.g. "hermano", "vecino", "proveedor"), timestamps.
- [ ] Migration `CreateClientReferencesTable`.
- [ ] `POST/PATCH/DELETE` under `/clients/:id/references` or embedded in the client create/update payload — pick whichever matches how `ClientForm` naturally submits (confirm with client-side scope before deciding).

### Migration
- [ ] `AddExtendedProfileFieldsToClients` (or split into multiple small migrations per `docs/DATABASE.md`'s migration conventions — one column group per logical concern is fine here).

### Tests (mandatory)
- [ ] New nullable columns don't break any existing `ClientsService` test (create/update with and without the new fields).
- [ ] `ClientReference` CRUD, if built as its own table: create/list/delete references for a client, cascade behavior on client deletion (soft-delete should almost certainly leave references intact, mirroring the rest of this project's soft-delete conventions — but confirm, don't assume).

### Swagger
- [ ] All new/changed endpoints and DTOs documented.

## Definition of done for this phase

- Every field confirmed in "Before starting this phase" is captured on `Client` (or `ClientReference`), stored, and returned by `GET /clients/:id`.
- Image fields follow the exact same api-never-touches-bytes rule as `Payment.imageUrl`.
- The confirmed mandatory/optional split from open question 6 is implemented exactly as agreed, including any matching update to Excel import.
- All items in `docs/DEFINITION_OF_DONE.md` checklist pass.

## After this phase

Update `docs/DATABASE.md` (`clients` table plus new `client_references` table if built) and `docs/GLOSSARY.md` with the confirmed field list and any new terms (e.g. "referencia comercial" if it needs its own definition).

## Related documents

- `docs/phases/PHASE_3_CLIENTS.md` — existing client CRUD this phase extends
- `docs/phases/PHASE_8_EXCEL_IMPORT.md` — bulk import that may need matching changes
- `docs/phases/PHASE_12_PAYMENT_ATTACHMENTS.md` — the image-hosting pattern reused here
- `docs/DATABASE.md`, `docs/GLOSSARY.md`
