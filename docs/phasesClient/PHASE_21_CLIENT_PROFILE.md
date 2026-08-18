# Phase 21 — Extended Client Profile (KYC) (Client)

**Status: scope confirmed (2026-08-18) — mirrors `docs/phases/PHASE_21_CLIENT_PROFILE.md`, read that document first for the full field list and the reasoning behind each decision.**

## Goal

Capture and display the expanded client profile fields (identification detail, contact/address data, references, ID and selfie photos, data-processing consent) requested by the business, plus the co-debtor fields on the loan form. Mirrors `docs/phases/PHASE_21_CLIENT_PROFILE.md`.

## Required reading before starting

`docs/phases/PHASE_21_CLIENT_PROFILE.md` (the `api` counterpart and its confirmed decisions), `docs/GLOSSARY.md`, `docs/DATABASE.md`, `docs/phasesClient/PHASE_12_PAYMENT_ATTACHMENTS.md` for the existing `lib/imageUpload.ts` wrapper this phase extends (widened to accept PDFs, not just images — see the api doc's "Uploads" section).

## Scope

### Client form
- [ ] `ClientForm.tsx` grows significantly — sectioned (e.g. "Datos personales", "Contacto", "Direcciones", "Referencias", "Documentos", "Autorización") rather than one flat list of fields.
- [ ] Reuse `lib/imageUpload.ts` (widened to accept PDF as well as image) for the ID document front/back and consent-document uploads — same upload-before-submit pattern already used in `RegisterPaymentDialog.tsx`.
- [ ] References sub-section: repeatable add/remove list UI for `client_references` — an "Agregar referencia" button reveals a new blank set of fields each time (name, phone, relationship), for both `personal` and `comercial` types, with no fixed count. Existing references are editable and removable afterward.
- [ ] "Autorización de tratamiento de datos" section: a required checkbox ("El cliente firmó la autorización de tratamiento de datos") that must be checked before the form can be submitted — form-level validation, not just a DB constraint. An optional file field to upload a photo/PDF of the signed physical authorization, clearly marked optional.
- [ ] Selfie field explicitly marked optional in its label/help text (e.g. "opcional — el cliente puede negarse a proporcionarla"), consistent with it never being enforced as required.

### Client detail page
- [ ] `ClientDetailPage.tsx`: surface the new fields, sectioned the same way as the form.
- [ ] ID document (front/back) and selfie photos shown as thumbnails with the same click-to-enlarge lightbox pattern already built in `LoanDetailPage.tsx` (Phase 12) — extract into a small shared component instead of copy-pasting a second time.
- [ ] Show whether data-processing consent was recorded, when, and a link/thumbnail to the uploaded evidence document if one was provided.

### Loan form and detail (co-debtor)
- [ ] `LoanForm.tsx`: optional "Codeudor" section (full name, document type/number, phone, address, relationship to the debtor, optional ID photo upload) — a loan can be saved with no co-debtor.
- [ ] `LoanDetailPage.tsx`: surface the co-debtor's data if present, same lightbox pattern for the optional photo.
- [ ] `RefinanceLoanForm.tsx`: confirm whether co-debtor data should carry over when refinancing, or needs re-entry — default to carrying over, editable.

### Excel import
- [ ] Not affected — per the api doc's decision 6, the new `Client` fields (including `dataProcessingConsent`) stay unenforced on the bulk-import path. `ImportClientsDialog.tsx` needs no changes for this phase.

## Definition of done for this phase

- Every confirmed field from the api phase is fillable on `ClientForm.tsx`/`LoanForm.tsx` and visible on `ClientDetailPage.tsx`/`LoanDetailPage.tsx`.
- The data-processing consent checkbox blocks client creation until checked; the evidence-document upload does not.
- References can be added and removed from the client form without a page reload, for both types, with no fixed count.
- Co-debtor fields are entirely optional on the loan form.
- ID/selfie/consent-document uploads work the same way payment receipts do, with the same fail-loud-not-silent behavior on upload failure.
- All items in `docs/DEFINITION_OF_DONE.md` checklist pass.

## Related documents

- `docs/phases/PHASE_21_CLIENT_PROFILE.md` — the api counterpart and the confirmed decisions this UI reflects
- `docs/phasesClient/PHASE_12_PAYMENT_ATTACHMENTS.md` — the upload pattern and lightbox component reused here
- `docs/DATABASE.md`, `docs/GLOSSARY.md`
