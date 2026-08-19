# Phase 21 — Extended Client Profile (KYC)

**Status: scope and field list confirmed (2026-08-18) — ready for implementation.** The open questions from the original scoping pass are resolved below, in agreement with the business owner and the dev team. A companion one-page legal summary on data-protection obligations (Ley 1581 de 2012 / Decreto 1377 de 2013) was shared separately with the business owner and is not duplicated here.

## Goal

Capture significantly more information per client at signup — identification detail, contact/address data, employment info, personal and commercial references, and photo documentation (ID scan, selfie) — so the business has real collateral information on file for a lending relationship, not just enough to send a WhatsApp reminder. Requested directly by the client; not previously scoped in `docs/PROJECT_ROADMAP.md`.

## Decisions (resolving the original "before starting" open questions)

1. **Final field list** — confirmed below under "Scope."
2. **References** — built as their own `client_references` table (not flat columns), presented as a dynamic add/remove list in the UI (an "agregar referencia" button that reveals a new blank set of fields each time, editable afterward). No fixed minimum or maximum count, for both `personal` and `comercial` types.
3. **Document photos** — two nullable fields, front and back. Each accepts either an image or a PDF (e.g. if the business already has a combined scan), reusing the existing Cloudinary upload pattern with the resource type widened from image-only to `auto`.
4. **Scanned pagaré photo** — discarded from scope entirely, on either `Client` or `Loan` (see `docs/PROJECT_ROADMAP.md` Phase 21 note).
5. **Employment/income fields** — in scope: `occupation`, `employer_name`, `monthly_income` on `Client`.
6. **Mandatory vs. optional** — every new `Client` KYC column stays nullable/optional at the database level, including at Excel bulk import (`docs/phases/PHASE_8_EXCEL_IMPORT.md` is unaffected). Two fields are required specifically on the interactive `ClientForm` creation flow, enforced in `ClientsService.create()` rather than as a DB constraint: `dataProcessingConsent` (must be `true`) and, per client feedback after reviewing the built form, `documentType` (must be set). Excel-imported clients are exempt from both and get them filled in later from the client's profile page.
7. **Document issue date** — `document_issue_date` (DATE, nullable), added alongside the pre-existing `document_issue_place` per the same round of client feedback.
8. **Co-debtor (codeudor)** — belongs to `Loan`, not `Client`: confirmed with the business that whether a loan has a co-debtor varies per loan, not per client. Modeled as nullable columns directly on `Loan` (max one co-debtor per loan — no separate table needed).
9. **Data-processing consent** — `dataProcessingConsent` (boolean, required to create a client through `ClientForm`), `consentGivenAt` (timestamp, set when the checkbox is confirmed), `consentDocumentUrl` (optional — photo or PDF of the physically signed authorization, same externally-hosted-URL pattern as everything else). The actual authorization is obtained on paper/in person at the point of sale, outside the software — the system only records that it happened and optionally stores the scanned evidence. Confirmed as a deliberate CYA measure: the field exists and is available, its use by the business is the business's own choice.

## Required reading before starting

`docs/GLOSSARY.md`, `docs/DATABASE.md` (`clients` and `loans` tables), `docs/phases/PHASE_3_CLIENTS.md` (existing CRUD this phase extends), `docs/phases/PHASE_8_EXCEL_IMPORT.md` (bulk import — unaffected per decision 6 above), `docs/phases/PHASE_12_PAYMENT_ATTACHMENTS.md` (the image-hosting pattern this phase reuses, widened to accept PDFs for document fields).

## Scope

### `Client` entity — new columns, all nullable unless noted
- [ ] `document_type` (ENUM: `cedula_ciudadania`, `cedula_extranjeria`, `pasaporte`)
- [ ] `date_of_birth` (DATE)
- [ ] `document_issue_place` (VARCHAR)
- [ ] `document_issue_date` (DATE) — added after initial implementation, per client feedback
- [ ] `email` (VARCHAR)
- [ ] `alternate_phone_number` (VARCHAR)
- [ ] `home_address` (TEXT)
- [ ] `work_address` (TEXT)
- [ ] `neighborhood` (VARCHAR), `city` (VARCHAR)
- [ ] `occupation` (VARCHAR), `employer_name` (VARCHAR), `monthly_income` (DECIMAL)
- [ ] `id_document_front_url`, `id_document_back_url` (VARCHAR) — image or PDF, same URL-only pattern as `Payment.imageUrl`
- [ ] `selfie_image_url` (VARCHAR) — never mandatory; this is sensitive/biometric data under Ley 1581, and no activity can be conditioned on providing it
- [ ] `data_processing_consent` (BOOLEAN, NOT NULL, default `false`) — required at creation via `ClientForm`; not enforced for Excel-imported clients
- [ ] `consent_given_at` (TIMESTAMP, nullable)
- [ ] `consent_document_url` (VARCHAR, nullable) — optional photo/PDF of the signed physical authorization

### New entity: `client_references`
- [ ] `ClientReference`: `id`, `client_id` (FK), `type` (`personal` | `comercial`), `full_name`, `phone_number`, `relationship` (free text), timestamps.
- [ ] Migration `CreateClientReferencesTable`.
- [ ] `POST`/`PATCH`/`DELETE` under `/clients/:id/references` (confirm exact shape against how `ClientForm` submits once built).

### `Loan` entity — new columns, all nullable
- [ ] `co_debtor_full_name` (VARCHAR)
- [ ] `co_debtor_document_type` (ENUM, same values as `Client.documentType`)
- [ ] `co_debtor_document_number` (VARCHAR)
- [ ] `co_debtor_phone_number` (VARCHAR)
- [ ] `co_debtor_address` (TEXT)
- [ ] `co_debtor_relationship` (VARCHAR) — relación con el deudor principal
- [ ] `co_debtor_id_document_url` (VARCHAR, nullable) — optional
- [ ] No income/employment fields for the co-debtor — identification and contact only, confirmed sufficient for the business's purpose (locating/contacting them if needed), not a full credit evaluation.

### Migrations
- [ ] `AddExtendedProfileFieldsToClients` (may split into smaller migrations per logical group, per `docs/DATABASE.md`'s conventions).
- [ ] `CreateClientReferencesTable`.
- [ ] `AddCoDebtorFieldsToLoans`.

### Uploads
- [ ] `apps/client/src/lib/imageUpload.ts` — widen from the hardcoded `image/upload` Cloudinary endpoint to `auto` so document/consent fields can accept a PDF as well as an image. No new provider or backend upload code needed.

### Tests (mandatory)
- [ ] New nullable columns on `Client` and `Loan` don't break any existing `ClientsService`/`LoansService` test (create/update with and without the new fields).
- [ ] `ClientReference` CRUD: create/list/delete references for a client; cascade behavior on client soft-delete leaves references intact (mirrors the project's soft-delete conventions elsewhere — confirmed, not assumed).
- [ ] `dataProcessingConsent` is enforced (rejected) as required on the manual client-creation endpoint, and *not* enforced on the Excel-import path.
- [ ] Loan co-debtor fields: created/updated correctly, no validation forcing their presence (a loan without a co-debtor is still valid).

### Swagger
- [ ] All new/changed endpoints and DTOs documented, including the front/back document fields' PDF-or-image acceptance and the consent requirement on `POST /clients`.

## Definition of done for this phase

- Every field listed above is captured on `Client`, `Loan`, or `ClientReference`, stored, and returned by the relevant `GET` endpoints.
- Image/PDF fields follow the exact same api-never-touches-bytes rule as `Payment.imageUrl`.
- `dataProcessingConsent` is required on the interactive client-creation flow and exempt on Excel import, exactly as decided.
- The co-debtor fields live on `Loan`, not `Client`.
- All items in `docs/DEFINITION_OF_DONE.md` checklist pass.

## After this phase

Update `docs/DATABASE.md` (`clients`, `loans`, and the new `client_references` table) and `docs/GLOSSARY.md` with the confirmed field list and any new terms (e.g. "codeudor," "referencia comercial"). Separately from this codebase: the business owner should formalize, with legal counsel, an otrosí/addendum to the existing development contract clarifying data-controller roles, plus the business's own Política de Tratamiento de Datos Personales and Aviso de Privacidad — see the one-page summary already shared.

## Related documents

- `docs/phases/PHASE_3_CLIENTS.md` — existing client CRUD this phase extends
- `docs/phases/PHASE_4_LOANS_INSTALLMENTS.md` — the `Loan` entity the co-debtor fields extend
- `docs/phases/PHASE_8_EXCEL_IMPORT.md` — bulk import, confirmed unaffected
- `docs/phases/PHASE_12_PAYMENT_ATTACHMENTS.md` — the image-hosting pattern reused here
- `docs/DATABASE.md`, `docs/GLOSSARY.md`
