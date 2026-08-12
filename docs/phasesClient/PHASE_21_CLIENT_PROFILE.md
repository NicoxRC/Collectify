# Phase 21 — Extended Client Profile (KYC) (Client)

## Goal

Capture and display the expanded client profile fields (identification detail, contact/address data, references, ID and selfie photos) requested by the business. Mirrors `docs/phases/PHASE_21_CLIENT_PROFILE.md` — **read that document first**, since the final field list, the reference data shape, and the mandatory/optional split are all open questions that must be confirmed with the client before this UI can be built correctly.

## Required reading before starting

`docs/phases/PHASE_21_CLIENT_PROFILE.md` (the `api` counterpart and its "Before starting" open questions), `docs/GLOSSARY.md`, `docs/DATABASE.md`, `docs/phases/PHASE_12_PAYMENT_ATTACHMENTS.md`'s client-side counterpart (`docs/phasesClient/PHASE_12_PAYMENT_ATTACHMENTS.md`) for the existing `lib/imageUpload.ts` wrapper this phase reuses as-is for the ID and selfie photos — no new upload code needed, just new call sites.

## Scope (once the api-side open questions are confirmed)

### Client form
- [ ] `ClientForm.tsx` grows significantly — likely needs sectioning (e.g. "Datos personales", "Contacto", "Direcciones", "Referencias", "Documentos") rather than one flat list of fields, given how many are being added. Confirm layout doesn't need a Figma frame first (none is expected to exist, per precedent from Phases 9-12) — but flag to the client that a form this size benefits from a real design pass rather than another no-frame build.
- [ ] Reuse `lib/imageUpload.ts` (Phase 12) for the ID document and selfie uploads — same upload-before-submit pattern already used in `RegisterPaymentDialog.tsx`.
- [ ] References sub-section: if the api ships `ClientReference` as its own table (open question 2 in the api doc), this needs its own small repeatable add/remove list UI (add reference, remove reference, min/max count per whatever gets confirmed) — not a fixed number of hardcoded fields.

### Client detail page
- [ ] `ClientDetailPage.tsx`: surface the new fields — likely also needs sectioning to avoid one long undifferentiated list, matching whatever grouping the form uses.
- [ ] ID document and selfie photos shown as thumbnails with the same click-to-enlarge lightbox pattern already built in `LoanDetailPage.tsx` (Phase 12) — this should be extracted into a small shared component instead of copy-pasted a second time, since it'll now exist in two places.

### Excel import
- [ ] Only relevant if the api-side open question on mandatory/optional resolves to requiring new fields at creation — if so, `ImportClientsDialog.tsx` and its preview table need matching columns. If the new fields stay optional, bulk import is unaffected and this can be skipped entirely for this phase.

## Definition of done for this phase

- Every confirmed field from the api phase is fillable on `ClientForm.tsx` and visible on `ClientDetailPage.tsx`.
- ID and selfie photos upload the same way payment receipts do, with the same fail-loud-not-silent behavior on upload failure.
- References (if built as a separate table) can be added and removed from the client form without a page reload.
- All items in `docs/DEFINITION_OF_DONE.md` checklist pass.

## Related documents

- `docs/phases/PHASE_21_CLIENT_PROFILE.md` — the api counterpart and its open questions this UI must reflect once resolved
- `docs/phasesClient/PHASE_12_PAYMENT_ATTACHMENTS.md` — the upload pattern and lightbox component reused here
- `docs/DATABASE.md`, `docs/GLOSSARY.md`
