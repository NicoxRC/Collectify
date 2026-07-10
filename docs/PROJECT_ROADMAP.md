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

## Related documents

- `DATABASE.md` — the data model each phase builds against, including open questions to resolve before Phase 6
- `ARCHITECTURE.md` — technical structure supporting these phases
- `GLOSSARY.md` — business terms referenced throughout this roadmap
- Jira — day-to-day tasks, estimates, and assignments for each phase
