# Project Roadmap

This document outlines the high-level development phases for Collectify. It answers "what comes before what" at a strategic level. **Individual tasks, estimates, and assignments live in Jira** — this document never lists tasks with IDs or owners; if you're looking for that level of detail, go to the board.

## How to read this roadmap

Each phase below is a coherent chunk of working functionality — not a sprint, not a fixed time box. Phases can overlap: once the REST contract for a phase is agreed between `api` and `client` developers, both sides can build in parallel (see `ARCHITECTURE.md`).

---

## Phase 1 — Foundation

Set up the skeleton both applications run on, with nothing business-specific yet.

- Repository structure, Docker Compose for local PostgreSQL
- NestJS project scaffolded: TypeORM connection, global config, global exception filter, response interceptor, Swagger setup
- React + Vite project scaffolded: routing, Tailwind, TanStack Query client, base layout (sidebar/header)
- Railway deployment configured for `api`; Cloudflare Pages configured for `client`
- Manual deployment flow documented (see `README.md`)

**Exit criteria:** an empty but working app is deployed and reachable in production; a developer can clone the repo and be running locally within the steps in `README.md`.

## Phase 2 — Authentication and roles

- `User` entity, JWT login/refresh flow, role guard (`admin` / `collector`)
- Login page, protected routes, role-based UI hiding on the client

**Exit criteria:** both roles can log in and see a role-appropriate (even if empty) dashboard shell.

## Phase 3 — Clients

- `Client` entity (with `document_number`, `phone_number`) and full CRUD
- Client list, search, create/edit form, detail page on the client

**Exit criteria:** clients can be fully managed through the panel — this replaces the client-management part of the current Excel process.

## Phase 4 — Loans and installments

The core of the business domain — see `DATABASE.md` and `GLOSSARY.md` for the confirmed model.

- `Loan` entity (with `promissory_note_number`, `interest_rate`, `installment_frequency`)
- `Installment` entity, generated from a loan's terms (total installments, frequency, due dates)
- `Payment` entity, linked to installments, supporting partial payments
- Overdue calculation logic (per installment, on read) and the confirmed interest formula
- Loan list/detail, installment view within a loan, register-payment flow on the client

**Exit criteria:** a loan can be created, its installments tracked, payments registered, and overdue days + interest calculated correctly per installment — verified against the real examples from `LIBRO_PARA_COBRAR.xlsx`.

## Phase 5 — WhatsApp reminders

- Meta Cloud API integration in `WhatsAppService`
- `MessageTemplate` entity and management (list/create/edit/activate)
- Weekly CronJob: groups overdue installments **by client** (not by loan), renders the active template, sends one consolidated message, logs it via `MessageLog` + `MessageLogItem`
- Manual "send now" trigger, pause/resume control
- Message history view on the client

**Exit criteria:** the weekly reminder job runs automatically and produces messages matching the real format the client currently sends manually — this is the phase that actually replaces the manual WhatsApp process.

## Phase 6 — Refinancing

- `refinanced_from_loan_id` relationship and the refinancing flow: close old loan, create new loan with new installments
- Resolve the open question from `DATABASE.md` (what happens to the old loan's remaining installments) with the client before building this
- UI flow to refinance a loan from its detail page

**Exit criteria:** a loan can be refinanced end-to-end, with full history preserved (old loan visible as `refinanced`, linked to the new one).

## Phase 7 — Dashboard and reports

- Summary KPIs (total clients, overdue installments, total amount overdue, messages sent this week)
- Sortable overdue list, monthly report (new loans, payments received, messages sent)

**Exit criteria:** the owner has a single screen answering "how is my portfolio doing right now" without opening Excel.

## Phase 8 — Polish and secondary features

- Excel import for bulk client onboarding (if still needed once manual entry is in place)
- User management UI (creating/deactivating collector accounts)
- Any UI/UX refinement based on real usage feedback from the client

## Phase 9 — Additional WhatsApp message types

Phase 5 only covered the weekly overdue reminder. Real usage requires three more message types, confirmed against real WhatsApp examples the client shared: a one-time "new loan" confirmation, a pre-due-date reminder ("Aviso", at 5/3/1 days before), and an on-demand full account summary across all of a client's active pagarés. See `docs/phases/PHASE_9_MESSAGE_TYPES.md` for full scope and the judgment calls made.

- `MessageTemplate`/`MessageLog` gain a `type` field — one admin-editable template per message type instead of a single global one
- New-loan message sent synchronously at loan creation/refinance
- Daily cron for the upcoming-due reminder, consolidated by client
- On-demand endpoint for the account summary message

**Exit criteria:** all four message types (including the existing overdue reminder) are admin-configurable via templates and produce output matching the real formats the client shared.

## Phase 10 — Client capacity (cupo) and reactivation

- A per-client credit limit ("cupo"), enforced automatically when creating a new loan
- Automatic block on new loans when a client has any installment overdue more than 30 days, even with cupo available
- Reactivation of soft-deleted clients

**Exit criteria:** a client's available cupo and mora-block status are visible and enforced at loan creation time; an inactive client is no longer a dead end.

## Phase 11 — Audit logging

- A generic, interceptor-based audit trail for sensitive actions (clients, loans, payments, users, templates, permissions) — who did what, and when
- Admin-only read-only log viewer

**Exit criteria:** an admin can answer "who did X" for any covered action without needing direct database access.

## Phase 12 — Payment attachments

- Attach a photo of the deposit/receipt when registering a payment; the API only stores the image URL, hosted externally (see `docs/phases/PHASE_12_PAYMENT_ATTACHMENTS.md` for the provider comparison)
- Render the payment's observation (already existed but was never displayed) and attached image in the payment history

**Exit criteria:** a payment's photo and observation are visible in the payment history, not just captured and hidden.

## Phase 13 — Initial installment (cuota inicial)

- Mark one installment at loan creation as an initial/down payment, exempt from mora

**Exit criteria:** a loan can have an initial installment that never accrues mora, regardless of when it's paid.

## Phase 14 — Configurable interest concepts (amortizador)

**Done.** Core engine and catalog shipped first; the quote/simulator tool ("Cotizador") shipped 2026-08-18 once its persistence question was resolved with the human — see `docs/phases/PHASE_14_INTEREST_CONCEPTS.md`.

- Replace the single flat interest rate and manually-entered installment amounts with an automatically generated amortization schedule, built from several interest/fee concepts per loan (on a declining balance), picked from an admin-managed catalog of concept types the admin can extend at any time
- Exact capital/concept breakdown available per installment on demand
- An on-the-spot quote/simulator tool ("amortizador proyector") so any authenticated user can show a prospective client what they'd pay before any loan is created — guaranteed to match real loan math exactly, since it reuses the same `POST /loans/preview-schedule` endpoint loan creation itself previews with, not a second implementation

**Exit criteria:** a loan can be created with multiple named concepts, the exact breakdown of what a client owes is retrievable per installment, and an admin can generate a same-session quote for a prospect without creating a loan record.

## Phase 15 — Usury rate ceiling (tasa de usura global)

- A global, month-to-month usury ceiling, admin-updatable, applied to interest calculations

**Exit criteria:** the current legal usury ceiling is tracked and enforced, instead of interest rates being unchecked against any legal maximum.

## Phase 16 — Early payoff and interest-first allocation (liquidación anticipada)

- Correct calculation of "what does the client owe if they pay off today," applying interest-first allocation (Colombian Civil Code Art. 1653) instead of summing remaining installment totals

**Exit criteria:** an early payoff quote reflects interest actually caused to date, not future interest that hasn't accrued.

## Phase 17 — Refinancing recalculation (abono a capital)

- Automatic calculation of the new principal when refinancing, derived from pending installments minus interest caused to date, replacing/pre-filling Phase 6's manual entry
- Optional extra paydown against the new principal at refinancing time

**Exit criteria:** refinancing produces a computed, explained new principal instead of a blank manually-entered figure.

## Phase 18 — Message audiences, cronjobs and log retention

- A curated group of clients attachable to each (still static, Meta-approved) message template, with a configurable send schedule
- Manual retry for failed message sends, without losing the sent-message history

**Exit criteria:** an admin can target a specific group of clients per template on its own schedule, and recover from a failed send without re-sending everything.

## Phase 19 — User management UI

**Done.** Backend confirmed complete since Phase 2 (verified 2026-08-18, see `docs/phases/PHASE_19_USER_MANAGEMENT.md`); frontend built 2026-08-18 (see `docs/phasesClient/PHASE_19_USER_MANAGEMENT.md`).

- Frontend for the company user management the API has supported since Phase 2 but never had a panel for: create, deactivate, reactivate collector/admin accounts

**Exit criteria:** an admin can manage company user accounts entirely through the panel.

## Phase 20 — Module permissions matrix

**Mechanism done; controller migration in progress.** Granular, per-employee control over which modules of the panel they can access, beyond the current binary admin/collector role — resolves the "exact permission boundaries" open note in `docs/GLOSSARY.md`. The permission model, guard, and UI (built 2026-08-18, see `docs/phases/PHASE_20_MODULE_PERMISSIONS.md`) are all in place and working end-to-end for one controller (`MessageTemplatesController`) migrated as the initial low-risk proof, per that phase's own incremental-migration requirement. The remaining admin-only controllers (`InterestConceptTypesController`, audit log, usury rates, `UsersController`) are still on the older binary role check and each need their own small follow-up to migrate — see that doc's "Guard and enforcement" section for the exact list.

**Exit criteria:** an admin can control module-level access per employee. *(Met for the mechanism and for one module; full coverage across every previously admin-only module is the remaining follow-up work listed above.)*

## Phase 21 — Extended client profile (KYC)

- Significantly more data captured per client at signup — identification detail, contact/address data, employment info, personal and commercial references, and photo documentation (ID scan, selfie) — requested directly by the client for lending risk/security purposes
- See `docs/phases/PHASE_21_CLIENT_PROFILE.md` for the proposed field list and the open questions that must be confirmed with the client before this phase starts (final field list, reference data shape, document photo count, whether the scanned pagaré belongs here or on `Loan`, mandatory vs. optional)

**Exit criteria:** the confirmed extended field set is captured, stored, and visible on a client's profile, with ID/selfie photos following the same externally-hosted-URL pattern as `Payment.imageUrl` (Phase 12).

---

## Explicitly out of scope for now

These were discussed and intentionally deferred — tracked here so nobody assumes they were forgotten, and revisited only once the core system is stable in production:

| Item | Why deferred |
|---|---|
| CI/CD pipeline | No prior experience with it on the team yet; manual deployment is acceptable at current scale (see `DEFINITION_OF_DONE.md`) |
| End-to-end / integration tests | Unit tests on services are the current bar (see `TESTING.md`) |
| Fixed test coverage thresholds | Deliberately not enforced — see `TESTING.md` |
| Public-facing marketplace | Discussed as a possible future direction; would likely be a **separate application**, not a retrofit of this admin panel (see `ARCHITECTURE.md`) |
| Mobile app | Mentioned as a future possibility; the current REST API is not designed against this requirement yet — would need revisiting if it becomes concrete |
| Multi-tenant support (selling this to other lending businesses) | Not designed for yet; would require significant changes to the data model (currently single-tenant) |
| Payment gateway integration | Deferred — explicitly excluded from the Phase 10-20 documentation round; scope not yet defined |
| Electronic signature | Deferred — explicitly excluded from the Phase 10-20 documentation round; scope not yet defined |

## Related documents

- `DATABASE.md` — the data model each phase builds against, including open questions to resolve before Phase 6
- `ARCHITECTURE.md` — technical structure supporting these phases
- `GLOSSARY.md` — business terms referenced throughout this roadmap
- Jira — day-to-day tasks, estimates, and assignments for each phase
