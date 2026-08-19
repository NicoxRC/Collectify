# Database

This document describes the data model, naming conventions, and migration policy for Collectify's PostgreSQL database.

> **Note:** This model was revised after reviewing the client's actual spreadsheets (`DEUDORES_ACTUALIZADA.xlsx`, `LIBRO_PARA_COBRAR.xlsx`) and real WhatsApp reminder examples. The business is structured around **installments (cuotas)**, not single due dates per loan — see `GLOSSARY.md` for full term definitions.

## Conventions

### Primary keys — UUID

Every table uses a `UUID` primary key, generated at the database level:

```sql
id UUID PRIMARY KEY DEFAULT gen_random_uuid()
```

```typescript
@PrimaryGeneratedColumn('uuid')
id: string;
```

### Naming — snake_case

Tables and columns use **snake_case**; TypeORM maps this automatically to camelCase in code via a global naming strategy (`SnakeNamingStrategy`) — see `CODING_STANDARDS.md`.

### Table names — plural, snake_case

`clients`, `loans`, `installments`, `payments`, `message_templates`, `message_audiences`, `message_audience_clients`, `message_logs`, `message_log_items`, `users`, `audit_logs`.

### Timestamps — every table has them

```sql
created_at TIMESTAMPTZ NOT NULL DEFAULT now()
updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
```

### Soft delete — always, no hard deletes

Every table (except `message_logs`, `message_log_items`, and `audit_logs`, which are append-only, see below) includes `deleted_at`, handled via TypeORM's `@DeleteDateColumn` and `.softDelete()`.

## Business model overview — read this first

Before looking at the tables, understand the real structure confirmed from the client's data:

1. A **client** can have **multiple loans** (called *pagarés* in the business — see `GLOSSARY.md`), active at the same time.
2. A **loan** is not paid in one lump sum — it's divided into **installments (cuotas)**, each with its own due date and its own amount.
3. **Overdue days are calculated per installment**, not per loan — an installment is overdue the moment its own due date passes, independent of the other installments in the same loan.
4. **Interest accrues per overdue installment**, using this confirmed formula:
   ```
   interest = installment_amount × (interest_rate / 100) / 30 × overdue_days
   total_due_for_installment = installment_amount + interest
   ```
5. The **weekly WhatsApp reminder groups every overdue installment for a client — across all of their loans — into a single message**, with a grand total to pay. This is confirmed from the real message examples the client shared.
6. Loans can be **refinanced**: an old loan is closed out and a new loan is created in its place, typically consolidating remaining balance plus accrued interest into a new set of installments.

## Entity-relationship overview

```
users                     clients                       loans
┌─────────────────┐       ┌──────────────────┐          ┌───────────────────────────┐
│ id (PK)         │       │ id (PK)          │          │ id (PK)                   │
│ full_name       │       │ first_name       │          │ client_id (FK)            │──┐
│ email           │       │ last_name        │◄─────────│ promissory_note_number    │  │
│ password_hash   │       │ document_number  │   1:N     │ principal_amount          │  │
│ role            │       │ phone_number     │          │ interest_rate             │  │
│ created_at      │       │ created_at       │          │ disbursed_at              │  │
│ updated_at      │       │ updated_at       │          │ installment_frequency     │  │
│ deleted_at      │       │ deleted_at       │          │ total_installments        │  │
└─────────────────┘       └──────────────────┘          │ status                    │  │
                                                          │ refinanced_from_loan_id   │  │
                                                          │ created_at                │  │
                                                          │ updated_at                │  │
                                                          │ deleted_at                │  │
                                                          └───────────────────────────┘  │
                                                                                          │
                          message_templates                installments                 │
                          ┌──────────────────┐             ┌──────────────────┐          │
                          │ id (PK)          │             │ id (PK)          │          │
                          │ name             │             │ loan_id (FK)     │◄─────────┘
                          │ content          │             │ installment_num  │
                          │ is_active        │             │ amount           │
                          │ created_at       │             │ due_date         │
                          │ updated_at       │             │ status           │
                          │ deleted_at       │             │ created_at       │
                          └──────────────────┘             │ updated_at       │
                                   │                        │ deleted_at       │
                                   │                        └──────────────────┘
                                   │                                 │
                                   │ 1:N                             │ 1:N
                                   ▼                                 ▼
                          message_logs                       payments
                          ┌──────────────────┐               ┌──────────────────┐
                          │ id (PK)          │               │ id (PK)          │
                          │ client_id (FK)   │               │ installment_id   │
                          │ phone_number     │               │ amount_paid      │
                          │ message_content  │               │ paid_at          │
                          │ status           │               │ observation      │
                          │ sent_at          │               │ created_at       │
                          │ created_at       │               │ updated_at       │
                          └──────────────────┘               │ deleted_at       │
                                   │                          └──────────────────┘
                                   │ 1:N
                                   ▼
                          message_log_items
                          ┌────────────────────────┐
                          │ id (PK)                │
                          │ message_log_id (FK)    │
                          │ installment_id (FK)    │
                          │ overdue_days_snapshot  │
                          │ interest_snapshot      │
                          │ created_at             │
                          └────────────────────────┘
```

### Relationships

- One **client** has many **loans** (1:N)
- One **loan** has many **installments** (1:N)
- One **installment** has many **payments** (1:N) — partial payments are allowed
- One **loan** may reference a previous loan via `refinanced_from_loan_id` (self-referencing FK, nullable) — see "Refinancing" below
- One **client** has many **message_logs** (1:N) — one log entry per weekly reminder actually sent
- One **message_log** has many **message_log_items** (1:N) — one item per overdue installment included in that message
- One **installment** can appear in many **message_log_items** over time (it gets reminded about every week it stays overdue)

## Tables

### `users`

System users — Owner (Admin) and Collector roles, see `GLOSSARY.md`.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID | PK |
| `full_name` | VARCHAR | |
| `email` | VARCHAR | UNIQUE |
| `password_hash` | VARCHAR | bcrypt hash |
| `role` | ENUM (`admin`, `collector`) | |
| `is_active` | BOOLEAN | disable login without deleting |
| `created_at`, `updated_at`, `deleted_at` | TIMESTAMPTZ | standard |

### `user_module_permissions`

Added Phase 20 — per-user, per-module access grants, going beyond the binary `admin`/`collector` role. See `GLOSSARY.md` "Module permission".

| Column | Type | Notes |
|---|---|---|
| `id` | UUID | PK |
| `user_id` | UUID | FK → `users.id`, `ON DELETE CASCADE` |
| `module` | ENUM (`clients`, `loans`, `messages`, `message_templates`, `interest_concept_types`, `audit_log`, `usury_rates`, `users`) | matches the sidebar's top-level menu items, confirmed with the human — no separate "view" vs. "edit" granularity |
| `created_at` | TIMESTAMPTZ | standard |

Unique on (`user_id`, `module`). **Row presence is the grant — there's no boolean column.** Only ever populated for a `collector` account: an `admin` has full system access unconditionally, and `ModulePermissionsGuard` never even queries this table for one. A collector without a row for a given module simply can't reach it; an empty result set for a brand-new collector means no access anywhere until an admin grants some. The migration that created this table (`CreateUserModulePermissionsTable`) also seeded `clients`/`loans`/`messages` for every collector that existed at the time — those three were never behind the old `@Roles(UserRole.Admin)` guard, so seeding them was the zero-behavior-change starting point; nothing else was granted automatically.

### `clients`

| Column | Type | Notes |
|---|---|---|
| `id` | UUID | PK |
| `first_name` | VARCHAR | |
| `last_name` | VARCHAR | |
| `document_number` | VARCHAR | national ID (cédula) — confirmed required, present in both source spreadsheets as `DOCUMENTO` |
| `phone_number` | VARCHAR | E.164 format, e.g. `+573001234567` |
| `credit_limit` | DECIMAL(12,2), nullable | maximum credit exposure ("cupo") enforced at loan creation. Nullable — unset means no cupo is enforced for this client, same "absence of a value means the rule doesn't apply" convention as `loans.description`. Added Phase 10, see "Changed after Phase 10" below. |
| `document_type` | ENUM (`cedula_ciudadania`, `cedula_extranjeria`, `pasaporte`), nullable | Added Phase 21. Shared with `loans.co_debtor_document_type` via the same `DocumentType` enum. |
| `date_of_birth` | DATE, nullable | Added Phase 21. |
| `document_issue_place` | VARCHAR, nullable | Added Phase 21. |
| `document_issue_date` | DATE, nullable | Added Phase 21 (client feedback after reviewing the built form — `document_issue_place` already existed, the date didn't). |
| `email` | VARCHAR, nullable | Added Phase 21. |
| `alternate_phone_number` | VARCHAR, nullable | Added Phase 21. |
| `home_address` | TEXT, nullable | Added Phase 21. |
| `work_address` | TEXT, nullable | Added Phase 21. |
| `neighborhood` | VARCHAR, nullable | Added Phase 21. |
| `city` | VARCHAR, nullable | Added Phase 21. |
| `occupation` | VARCHAR, nullable | Added Phase 21. |
| `employer_name` | VARCHAR, nullable | Added Phase 21. |
| `monthly_income` | DECIMAL(12,2), nullable | Added Phase 21. |
| `id_document_front_url`, `id_document_back_url` | VARCHAR, nullable | Added Phase 21. Externally-hosted URLs only (image or PDF) — same convention as `payments.image_url` (Phase 12). The api never touches the file bytes. |
| `selfie_image_url` | VARCHAR, nullable | Added Phase 21. Never enforced as required anywhere in the app — this is sensitive/biometric data under Ley 1581 de 2012, and no activity may be conditioned on a titular providing it. |
| `data_processing_consent` | BOOLEAN, `NOT NULL DEFAULT false` | Added Phase 21. Enforced as required (must be `true`) in `ClientsService.create()` for interactively-created clients only — Excel-imported clients (`docs/phases/PHASE_8_EXCEL_IMPORT.md`) are exempt and default to `false`. The physical/in-person authorization is what actually authorizes the data processing under Colombian law; this column (plus the two below) only records that it happened — see `docs/phases/PHASE_21_CLIENT_PROFILE.md`. |
| `consent_given_at` | TIMESTAMPTZ, nullable | Added Phase 21. Stamped server-side (not caller-supplied) the moment `data_processing_consent` transitions to `true`, on both create and update. |
| `consent_document_url` | VARCHAR, nullable | Added Phase 21. Optional scan/photo of the signed physical authorization — evidence, not the authorization itself. Never enforced as required. |
| `created_at`, `updated_at`, `deleted_at` | TIMESTAMPTZ | standard |

**Changed after Phase 10 — cupo and mora-block rules confirmed with the client:**
- **"Cupo usado" (credit used)** = capital + interest accrued to date across the client's *active* loans' still-pending installments — the same `totalDue`-based sum already computed per loan as `outstandingBalance` (see `loans` below), just aggregated across every active loan instead of one. Refinanced-away and paid-off loans don't count (their `status` is no longer `active`). Not a stored column — computed on read by `ClientsService.getCreditUsage`/`findOneDetail`, exposed as `creditUsed`/`creditAvailable` on `GET /clients/:id`.
- **Mora block (+30 days)** is per-installment, not client-aggregate: a client is blocked from new loans as soon as *any single* pending installment across their active loans is more than 30 days overdue — not an average or the oldest one specifically. Computed on read by `ClientsService.hasMoraBlock`, exposed as `isMoraBlocked` on `GET /clients/:id`.
- Both are checked by `LoansService.create()` before a new loan is persisted, reported as two distinct rejection reasons (over cupo vs. mora-blocked) — see `docs/phases/PHASE_10_CLIENT_CAPACITY.md`.

### `client_references`

Added Phase 21 — a personal or comercial reference for a client. A dynamic add-many list: no fixed minimum or maximum, confirmed with the business (they wanted an open "add another" flow rather than a fixed number of slots). See `docs/phases/PHASE_21_CLIENT_PROFILE.md` decision 2.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID | PK |
| `client_id` | UUID | FK → `clients.id`, `ON DELETE CASCADE` — a client's references don't outlive the client |
| `type` | ENUM (`personal`, `comercial`) | |
| `full_name` | VARCHAR | |
| `phone_number` | VARCHAR | |
| `relationship` | VARCHAR | free text (e.g. "hermano", "vecino", "proveedor") — confirmed sufficient, no fixed catalog |
| `created_at`, `updated_at` | TIMESTAMPTZ | **no `deleted_at`** — unlike every other table here, references are hard-removed by the "quitar" action in `ClientForm`; there's no "reactivate a reference" concept. Surviving the parent client's own soft-delete is automatic (soft-delete only sets `clients.deleted_at`, it never touches rows referencing it), so no special handling is needed here for that. |

### `loans`

Represents a *pagaré* — see `GLOSSARY.md`.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID | PK (internal) |
| `client_id` | UUID | FK → `clients.id` |
| `promissory_note_number` | VARCHAR | **the business-facing identifier** — this is the `#743`, `#959` etc. seen in client messages and spreadsheets. Not the same as `id`. Must be unique and searchable. |
| `principal_amount` | DECIMAL(12,2) | total amount financed (`TOTAL` / `SALDO TOTAL` in the source sheets) |
| `interest_rate` | DECIMAL(5,2) | percentage, **moratory-only as of Phase 14** — see note below |
| `disbursed_at` | DATE | when the loan was given (`FECHA INICIAL`) |
| `installment_frequency` | ENUM (`monthly`, `biweekly`) | source data shows `MENSUAL` consistently; enum leaves room for other frequencies if they come up |
| `total_installments` | INT | total number of installments the loan is divided into (`CUOTAS`) |
| `status` | ENUM (`active`, `paid`, `refinanced`) | see `GLOSSARY.md` — **no `overdue` status at the loan level**, since overdue is an installment-level concept (see below) |
| `refinanced_from_loan_id` | UUID, nullable | self-referencing FK → `loans.id`. Set when this loan was created to replace an older one. See "Refinancing" below. |
| `description` | TEXT, nullable | free-text concept/reason for the loan (e.g. "Compra de Apple MacBook Air M5..."), used by the "new loan" WhatsApp message — see `docs/phases/PHASE_9_MESSAGE_TYPES.md`. Optional, same precedent as `payments.observation`. |
| `usury_ceiling_exceeded_at_creation` | BOOLEAN, `NOT NULL DEFAULT false` | Added Phase 15 — a one-time snapshot of whether this loan's highest per-installment effective rate exceeded the usury ceiling in effect at creation/refinance time. Not recomputed on read (confirmed: creation-time enforcement only). A warning, not a rejection — the loan is still created either way. See `docs/phases/PHASE_15_USURY_RATE.md`. |
| `usury_justification` | TEXT, nullable | Added Phase 15 — optional admin note explaining why the loan proceeded despite exceeding the ceiling. Only meaningful when the column above is `true`; never required. |
| `new_loan_message_sent_at` | TIMESTAMPTZ, nullable | Added Phase 18 — set once the "new loan" WhatsApp message actually succeeds (synchronously at creation/refinance, or via the retry cron). Lets the `new_loan` cron find loans still needing their message directly (`IS NULL`), instead of string-matching message content. See `docs/phases/PHASE_18_MESSAGE_AUDIENCES.md`. |
| `co_debtor_full_name` | VARCHAR, nullable | Added Phase 21 — co-debtor (codeudor) belongs to the **loan**, not the client: whether a given loan has one varies per loan, confirmed with the business. At most one per loan, so plain nullable columns rather than a separate table. See `docs/phases/PHASE_21_CLIENT_PROFILE.md` decision 7. |
| `co_debtor_document_type` | ENUM (`cedula_ciudadania`, `cedula_extranjeria`, `pasaporte`), nullable | Added Phase 21. Shares `clients.document_type`'s `DocumentType` enum. |
| `co_debtor_document_number` | VARCHAR, nullable | Added Phase 21. |
| `co_debtor_phone_number` | VARCHAR, nullable | Added Phase 21. |
| `co_debtor_address` | TEXT, nullable | Added Phase 21. |
| `co_debtor_relationship` | VARCHAR, nullable | Added Phase 21. Relationship to the primary debtor, free text. |
| `co_debtor_id_document_url` | VARCHAR, nullable | Added Phase 21. Externally-hosted URL (image or PDF), same convention as the client's own document URLs. |
| `initial_payment` | DECIMAL(12,2), nullable | Added Phase 13 (corrected after client QA) — the "cuota inicial": a down payment the client already made **outside** the credit system to cover the part of the purchase this loan doesn't finance. Purely informational — not one of this loan's installments, has no due date, accrues no interest, and never affects `principal_amount` or the amortization schedule. See `docs/phases/PHASE_13_INITIAL_INSTALLMENT.md`. |
| `created_at`, `updated_at`, `deleted_at` | TIMESTAMPTZ | standard |

**On the co-debtor and refinancing:** `LoansService.refinance()` carries the old loan's co-debtor over to the new loan unchanged by default (`dto.field ?? oldLoan.field` per field) — the refinance dto's co-debtor fields are optional and only override what's explicitly sent, so refinancing doesn't silently drop an existing co-debtor. See `docs/phases/PHASE_21_CLIENT_PROFILE.md`.

**On `interest_rate`:** confirmed from real data that the rate is **not** automatically tiered by amount, despite an informal rule mentioned by the client ("6% under 1 million, 5% over"). Actual historical data shows loans of the same amount range with rates of 4%, 5%, and 6%. The safest interpretation — **pending final confirmation with the client** — is that the rate is set manually per loan at creation time, defaulting to whatever the current standard rate is, but editable. Do not hardcode an automatic tiering rule based on this early analysis.

**Changed after Phase 14:** `interest_rate` is no longer used to price new loans — a loan's actual cost is now expressed entirely through named concepts (see `interest_concept_types` / `loan_installment_concepts` below). The column was not removed or renamed: it is kept, unchanged in shape, as the base rate `installmentCalculations.ts` uses for moratory (mora) interest on overdue installments — the open question above about how this rate is assigned/changes over time is still unresolved, just now scoped specifically to its moratory role rather than to ordinary loan pricing.

**On why there's no `status: 'overdue'` at the loan level:** a loan can have some installments overdue and others current, or even fully current with a future installment pending. "Overdue" is a derived state of an *installment*, not the loan as a whole. The loan's own dashboard/detail view aggregates its installments' statuses for display purposes but doesn't store a redundant "overdue" flag.

### `installments`

Represents a single *cuota* within a loan.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID | PK |
| `loan_id` | UUID | FK → `loans.id` |
| `installment_number` | INT | e.g. cuota 14 of 24 (`NO #` / `# DE CUOTAS` in source data) |
| `amount` | DECIMAL(12,2) | the installment's own amount (`VLR CUOTA`) — installments within a loan are not always equal, per real data |
| `principal_portion` | DECIMAL(12,2), nullable | Added Phase 14 — the capital-only part of `amount`, generated by the amortization schedule. Nullable because installments created before Phase 14 never had this calculated (their `amount` was a single hand-entered total with no capital/interest split). See `docs/phases/PHASE_14_INTEREST_CONCEPTS.md` and "Added in Phase 14" below. |
| `due_date` | DATE | this installment's specific due date (`FECHA COBRO` / `FECHA CUOTA`) |
| `status` | ENUM (`pending`, `paid`, `cancelled`) | overdue is **calculated on read**, never stored — see below. `cancelled` is set when the parent loan is refinanced with this installment still pending — see "Refinancing" |
| `created_at`, `updated_at`, `deleted_at` | TIMESTAMPTZ | standard |

~~`is_initial` BOOLEAN~~ — added in Phase 13, **removed after client QA** (2026-08-18): a cuota inicial is not one of the loan's installments at all (see `loans.initial_payment` above). Migration `ReplaceIsInitialWithInitialPayment`.

**Overdue calculation (confirmed formula):**

```typescript
overdueDays = today > installment.dueDate
  ? differenceInDays(today, installment.dueDate)
  : 0;

interest = installment.amount * (loan.interestRate / 100) / 30 * overdueDays;

totalDueForInstallment = installment.amount + interest;
```

This matches the manual calculations found across both source spreadsheets — verified against multiple real examples.

### `payments`

| Column | Type | Notes |
|---|---|---|
| `id` | UUID | PK |
| `installment_id` | UUID | FK → `installments.id` — **payments are tracked per installment**, not per loan, allowing partial payments against a specific cuota |
| `amount_paid` | DECIMAL(12,2) | |
| `paid_at` | DATE | |
| `observation` | TEXT | nullable — the source data has many free-text notes like "pagó en el local", "recibió en el Bordo" |
| `image_url` | VARCHAR, nullable | Added Phase 12 — URL of the deposit receipt photo, hosted externally (Cloudinary). The api only stores this string; it never receives or processes the image itself, same "absence means not provided" convention as `observation`. See `docs/phases/PHASE_12_PAYMENT_ATTACHMENTS.md`. |
| `created_at`, `updated_at`, `deleted_at` | TIMESTAMPTZ | standard |

### `interest_concept_types`

Added Phase 14 — the admin-managed catalog of interest/fee concepts (e.g. "Interés remuneratorio", "Gastos de cobranza"). Confirmed with the human this must stay open-ended: the admin creates new concept types whenever needed, not a fixed/hardcoded list. See `docs/phases/PHASE_14_INTEREST_CONCEPTS.md`.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID | PK |
| `name` | VARCHAR | |
| `default_calculation_type` | ENUM (`percentage`, `fixed_amount`) | |
| `default_value` | DECIMAL(12,2), nullable | a suggested starting value, always overridable per installment |
| `is_active` | BOOLEAN, default `true` | deactivating removes the type from the picker for new loans without touching `loan_installment_concepts` rows already generated from it — those snapshot their own name/value, unaffected by later catalog edits |
| `created_at`, `updated_at`, `deleted_at` | TIMESTAMPTZ | standard |

### `loan_installment_concepts`

Added Phase 14 — one row per interest/fee concept applied to a specific installment (per installment, not per loan, since concepts can vary installment-to-installment — confirmed with the human).

| Column | Type | Notes |
|---|---|---|
| `id` | UUID | PK |
| `installment_id` | UUID | FK → `installments.id`, `ON DELETE CASCADE` |
| `interest_concept_type_id` | UUID, nullable | FK → `interest_concept_types.id`, `ON DELETE SET NULL` — kept only as a soft reference for reporting; everything needed to display or recompute this concept already lives on this row |
| `name_snapshot` | VARCHAR | copied from the type at generation time |
| `calculation_type` | ENUM (`percentage`, `fixed_amount`) | snapshotted |
| `value` | DECIMAL(12,2) | snapshotted — the % or flat figure actually used for this installment |
| `computed_amount` | DECIMAL(12,2) | the resulting currency amount this concept contributed to this installment, calculated once at generation time against the balance at that point, then stored — the schedule doesn't change with the passage of time the way mora does |
| `created_at`, `updated_at`, `deleted_at` | TIMESTAMPTZ | standard |

### `message_templates`

| Column | Type | Notes |
|---|---|---|
| `id` | UUID | PK |
| `name` | VARCHAR | |
| `type` | ENUM (`new_loan`, `upcoming_due`, `overdue`, `account_summary`), **UNIQUE** | which message flow this template renders — exactly one row per type, see `docs/phases/PHASE_9_MESSAGE_TYPES.md` |
| `content` | TEXT | supports placeholders — see below. **Not admin-editable — see "Changed after Phase 9" below.** |
| `cron_expression` | VARCHAR, nullable | Added Phase 18 — admin-editable cron schedule for this type's job. `NULL` falls back to a per-type code default (env-configurable) — see `WhatsappCronService` and `docs/phases/PHASE_18_MESSAGE_AUDIENCES.md`. |
| `created_at`, `updated_at`, `deleted_at` | TIMESTAMPTZ | standard |

**Template placeholders** — the per-installment line format is fixed per message type (matches the confirmed real message formats); the outer template (greeting, where the list/total go) is fixed too — see "Changed after Phase 9" below for why.

`overdue` (real message format shared by the client):

```
{{clientFullName}}
{{installmentsList}}   -- rendered block, one line per overdue installment:
                          "La cuota No. {{number}} del pagaré #{{promissoryNoteNumber}}
                           por ${{totalDue}} (incluidos intereses) venció hace {{overdueDays}} días."
{{grandTotal}}          -- sum of totalDueForInstallment across all included installments,
                           substituted WITH a leading "$" already included (e.g. "$158.000") —
                           template authors should not type a $ before this placeholder.
```

The real message format numbers each overdue installment with an emoji (1️⃣, 2️⃣...) and ends with "El valor a pagar hoy es $X". See `ARCHITECTURE.md` for how the `whatsapp` module renders this.

`new_loan` (sent once, at loan creation — see Phase 9):

```
{{clientFullName}} {{promissoryNoteNumber}} {{loanDescription}}
{{disbursedAt}} {{totalInstallments}} {{installmentsSummary}}
```

`upcoming_due` (sent as an installment approaches its due date — see Phase 9; same list structure as `overdue` but "vence en N días" instead of "venció hace N días", and **no grand total** — not present in the real "Aviso" example):

```
{{clientFullName}}
{{installmentsList}}   -- one line per upcoming installment
```

`account_summary` (on-demand full statement — see Phase 9; every pending installment, overdue or not, ending in a grand total):

```
{{clientFullName}}
{{installmentsList}}
{{grandTotal}}          -- also includes the leading "$" automatically, same as `overdue`
```

### `message_logs`

One row per reminder **actually sent to a client** — not per installment.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID | PK |
| `client_id` | UUID | FK → `clients.id` |
| `type` | ENUM (`new_loan`, `upcoming_due`, `overdue`, `account_summary`) | which message flow produced this log — added in Phase 9; historical rows backfilled to `overdue` |
| `phone_number` | VARCHAR | snapshot at send time |
| `message_content` | TEXT | the full rendered message, exactly as sent (all installments included, formatted) |
| `status` | ENUM (`sent`, `failed`) | |
| `sent_at` | TIMESTAMPTZ | |
| `retried_at` | TIMESTAMPTZ, nullable | Added Phase 18 — set on the ORIGINAL (failed) row once it's manually retried. Still append-only: this is a stamp on the historical row, not an edit of what was actually sent. |
| `retry_of_message_log_id` | UUID, nullable | Added Phase 18 — self-referencing FK → `message_logs.id`, `ON DELETE SET NULL`. Set on the NEW row created by a retry, pointing back at the original it retried. Both columns null on rows never retried; a retry that itself fails can be retried again, chaining further. |
| `created_at` | TIMESTAMPTZ | append-only, no `updated_at`/`deleted_at` |

### `message_audiences`

Added Phase 18 — a curated group of clients attached to one `message_template`. See "Message audience" in `GLOSSARY.md` for the additive-vs-audience-only semantics per type.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID | PK |
| `message_template_id` | UUID | FK → `message_templates.id`, `ON DELETE CASCADE` |
| `name` | VARCHAR | |
| `created_at`, `updated_at`, `deleted_at` | TIMESTAMPTZ | standard |

The schema allows multiple audiences per template, but the confirmed UI/service surface is exactly one — `MessageAudiencesService` always operates on the most-recently-created audience for a template, creating it on first `PUT`.

### `message_audience_clients`

TypeORM-managed `@ManyToMany`/`@JoinTable` join table, no separate entity class — plain composite-PK shape.

| Column | Type | Notes |
|---|---|---|
| `message_audience_id` | UUID | PK (composite), FK → `message_audiences.id`, `ON DELETE CASCADE` |
| `client_id` | UUID | PK (composite), FK → `clients.id`, `ON DELETE CASCADE` |

### `message_log_items`

Bridges a `message_log` to the specific installments it covered — since one message reports on multiple overdue installments across potentially multiple loans.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID | PK |
| `message_log_id` | UUID | FK → `message_logs.id` |
| `installment_id` | UUID | FK → `installments.id` |
| `overdue_days_snapshot` | INT | overdue days **at the moment this message was sent** — stored here because it changes daily; this is historical record, not the live value |
| `interest_snapshot` | DECIMAL(12,2) | interest amount **at the moment this message was sent** |
| `created_at` | TIMESTAMPTZ | append-only |

This table is what lets us reconstruct "what exactly did we tell this client on this date" without recalculating from current data — important since overdue days and interest change every day, but the message sent is historical fact.

Reused as-is across all message types added in Phase 9, not extended: for an installment that isn't overdue (a `new_loan` or not-yet-due `upcoming_due`/`account_summary` line), `overdue_days_snapshot` and `interest_snapshot` are legitimately `0` — `enrichInstallment()` already returns `0` for both in that case, this isn't a special case. "Days until due" for `upcoming_due` is not stored as a separate column; it's preserved as text in `message_logs.message_content`.

### `audit_logs`

Added Phase 11 — a generic, append-only trail of sensitive actions across the system (clients, loans, payments, users), written automatically by a global interceptor rather than hand-added logging calls in each service. See `docs/phases/PHASE_11_AUDIT_LOG.md`.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID | PK |
| `actor_user_id` | UUID, nullable | FK → `users.id`, `ON DELETE SET NULL` — nullable because not every action necessarily has an authenticated actor (e.g. a future cron-triggered action); `SET NULL` keeps the log entry (with its `metadata`) even after the acting user is deleted, rather than losing history |
| `action` | VARCHAR | `<entityType>.<verb>`, e.g. `client.create`, `loan.refinance`, `payment.register`, `user.deactivate` — free text, not an enum, since new actions are added by decorating a new endpoint (`@Audit()`), not by a schema migration |
| `entity_type` | VARCHAR | e.g. `client`, `loan`, `payment`, `user` |
| `entity_id` | UUID, nullable | the specific record this action affected — resolved from the endpoint's response for create actions, from the route's own `:id` otherwise (see `AuditLogInterceptor.resolveEntityId`) |
| `metadata` | JSONB, nullable | the request's route params and body at the time of the action; known-sensitive fields (`password`, `passwordHash`, etc.) are redacted to `[redacted]` before this is ever written — never stored in the clear |
| `created_at` | TIMESTAMPTZ | append-only, no `updated_at`/`deleted_at` — an audit trail that can itself be edited or deleted defeats its purpose |

Written by `AuditLogInterceptor`, registered globally (`APP_INTERCEPTOR`) but a no-op for any endpoint not decorated with `@Audit(action, entityType)` — read-only routes, auth, health checks, etc. produce no entry. A failed request (a thrown exception) never produces a log entry either; a failed *write* to `audit_logs` itself is logged and swallowed rather than failing the real request it was trying to record.

### `usury_rates`

Added Phase 15 — Colombia's legal usury ceiling, certified monthly by the Superintendencia Financiera. See `docs/phases/PHASE_15_USURY_RATE.md`.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID | PK |
| `effective_month` | DATE, **UNIQUE** | first day of the certified month (e.g. `2026-08-01`). Unique because a month's rate is never edited — a correction is a new row for a different month, not an update. |
| `rate_percentage` | DECIMAL(5,2) | the month's certified ceiling |
| `created_by` | UUID, nullable | FK → `users.id`, `ON DELETE SET NULL` — same pattern as `audit_logs.actor_user_id` |
| `created_at` | TIMESTAMPTZ | append-only, no `updated_at`/`deleted_at` — **historical rows, never mutated**, confirmed non-retroactive with the human (a new month's rate applies only to interest accruing from that point forward) |

`UsuryRateService.getCurrentRate()` returns the most recent row plus a computed `isStale` flag (true when that row's `effective_month` isn't the current calendar month) — not stored, since the SFC's publication date isn't a fixed day (see the phase doc's domain research).

## Refinancing

When a loan is refinanced:

1. The old loan's `status` is set to `refinanced`.
2. A new loan row is created with `refinanced_from_loan_id` pointing to the old loan's `id`.
3. The new loan gets its own `promissory_note_number`, `principal_amount` (typically the old balance + accrued interest), and its own set of `installments`.
4. The old loan's remaining pending installments, if any, have their `status` set to `cancelled` — a distinct status confirmed with the client, kept as historical record but excluded from overdue calculations, reminders, and dashboard totals (the same way `paid` installments are: `enrichInstallment` returns zero overdue days/interest/total due for both).

This mirrors patterns seen directly in the source data (e.g. `REFINANCIADO #981`, `SE REFINANCIO EN EL #1000`).

## Migrations

Same policy as before: no `synchronize: true`, one migration per schema change, committed in the same PR, migrations never edited after being merged. See prior version of this document's conventions — unchanged here except for the tables above.

```bash
npm run migration:generate -- src/migrations/DescriptiveName
npm run migration:run
npm run migration:revert
```

## Indexes

- Every foreign key (`client_id`, `loan_id`, `installment_id`, `message_log_id`, `actor_user_id`, `interest_concept_type_id`, `created_by` on `usury_rates`)
- `usury_rates.effective_month` — unique, and looked up on every loan creation/refinance to enforce the ceiling
- `loans.promissory_note_number` — looked up constantly, must be fast and unique
- `clients.document_number` — for search and duplicate prevention
- `clients.phone_number` — for search and WhatsApp matching
- `installments.due_date` and `installments.status` — the weekly CronJob queries heavily on both
- `audit_logs (entity_type, entity_id)` and `audit_logs (actor_user_id, created_at)` — back "show me the history for this record" and "show me what this user did, most recent first", the two filters the audit log screen supports (see `docs/phasesClient/PHASE_11_AUDIT_LOG.md`)
- `client_references.client_id` — every lookup is "give me this client's references"

## Open questions — confirm with client before finalizing

- [ ] Exact rule (if any) for how `interest_rate` is determined or changes over time

## Resolved from Phase 4

- ~~Whether installment amounts within a loan are always equal or can vary~~ → Confirmed: they can vary. `POST /loans` and `POST /loans/:id/refinance` both require an explicit `installmentAmounts` array (one amount per installment, must sum to `principalAmount`) rather than auto-splitting evenly.

## Resolved from Phase 6

- ~~What happens to remaining installments of a loan once it's refinanced~~ → Confirmed: they're marked `cancelled` — excluded from active overdue/reminder processing, kept as historical record. See "Refinancing" above.

## Added in Phase 9

- `message_templates.type` and `message_logs.type` — the system now supports four message types (`new_loan`, `upcoming_due`, `overdue`, `account_summary`), each with its own template, instead of a single global template. See `docs/phases/PHASE_9_MESSAGE_TYPES.md` for the full scope and the judgment calls made (e.g. why "list all active pagarés" and "total across all credits" were combined into one `account_summary` message instead of two).
- `loans.description` — free-text field supporting the `new_loan` message's "por concepto de X" line.

## Changed after Phase 9

- **`message_templates` is no longer admin-editable.** Phase 9 (and Phase 5 before it) treated `content` as something an admin edits freely through the API. In practice, WhatsApp only allows a business to *initiate* a conversation (as opposed to replying within an open 24h window) through a template Meta has pre-approved — see `CONFIGURACION_WHATSAPP_META.md`. A freely-editable `content` column in our own database doesn't reflect that reality: changing it without a matching change to the Meta-approved template would just break sending. So `is_active` and the create/update/activate/delete endpoints were removed (including the soft-delete endpoint added right before this change — same reasoning: deleting one of the 4 fixed rows would leave a message type with nothing to render and no way to recreate it outside a migration) — `type` is now `UNIQUE` (exactly one row per type), and `MessageTemplatesController` only exposes `GET /message-templates`, for the admin to see what's currently being sent.
- **Updating a template's content is a migration, not an API call** — the same controlled, reviewed process used for every other data change in this project (see "Migrations" above). `1784300000000-MakeMessageTemplatesStatic.ts` is both the migration that made this change and the one seeding the current canonical content per type; a future content change (e.g. after Meta approves new copy) follows the same pattern: a new migration.

## Added in Phase 11

- `audit_logs` — a generic, append-only trail of sensitive actions (client/loan/payment/user create/update/deactivate/reactivate/refinance/register), written automatically by a globally-registered interceptor rather than hand-added logging calls per service. See "`audit_logs`" above and `docs/phases/PHASE_11_AUDIT_LOG.md`.
- `InstallmentsController.registerPayment` now captures `@CurrentUser()` — previously it didn't capture the authenticated user at all. No new column on `payments`: the audit log entry is the record of who registered a payment, not a denormalized field on the payment itself.

## Added in Phase 12

- `payments.image_url` — nullable URL of the deposit receipt photo, hosted externally (Cloudinary). The api never receives or stores the image itself, only this string. See `docs/phases/PHASE_12_PAYMENT_ATTACHMENTS.md`.

## Added in Phase 14

- `interest_concept_types` — the admin-managed catalog of interest/fee concepts, extendable without a code change. See "`interest_concept_types`" above.
- `loan_installment_concepts` — the per-installment snapshot of concepts actually applied, immune to later catalog edits. See "`loan_installment_concepts`" above.
- `installments.principal_portion` — the capital-only part of an installment's `amount`, generated by the amortization schedule. Nullable for installments created before this phase.
- `loans.interest_rate` is no longer used to price new loans — see the "Changed after Phase 14" note under `loans` above. It remains, unchanged in shape, as the base rate for moratory interest on overdue installments.
- The amortization algorithm (declining balance, percentage concepts calculated against the balance before that installment's principal is subtracted, rounding remainder absorbed into the last installment) lives in `loans/amortization/generateSchedule.ts` — see `docs/phases/PHASE_14_INTEREST_CONCEPTS.md` for the full spec.
- **Not yet built:** the quote/simulator tool ("amortizador proyector") — the catalog and amortization engine it would reuse shipped first; see `docs/phases/PHASE_14_INTEREST_CONCEPTS.md`'s "Open question carried forward" section.

## Added in Phase 15

- `usury_rates` — historical, admin-entered monthly usury ceiling. See "`usury_rates`" above.
- `loans.usury_ceiling_exceeded_at_creation`, `loans.usury_justification` — see "`loans`" above.
- Enforcement is creation-time only, a warning rather than a block, and non-retroactive (a rate change never alters a past month's already-caused interest) — all confirmed with the human, see `docs/phases/PHASE_15_USURY_RATE.md` "Resolved".

## Added in Phase 18

- `message_templates.cron_expression` — admin-editable schedule per template; see "`message_templates`" above.
- `message_audiences`, `message_audience_clients` — curated per-template client group; see "`message_audiences`" above and "Message audience" in `GLOSSARY.md`.
- `message_logs.retried_at`, `message_logs.retry_of_message_log_id` — manual retry tracking, append-only (a retry always creates a new row rather than editing the original); see "`message_logs`" above.
- `loans.new_loan_message_sent_at` — lets the `new_loan` retry cron find loans still needing their message; see "`loans`" above.
- All four message types (`new_loan`, `upcoming_due`, `overdue`, `account_summary`) now have a cron job, not just the two that were already scheduled — additive audiences for the three with a dynamic condition, audience-only for `account_summary`, which has none. See `docs/phases/PHASE_18_MESSAGE_AUDIENCES.md` "Resolved".

## Added in Phase 21

- `clients` gained an extended KYC-style profile (document type/expiry-adjacent fields, address, employment, income, ID/selfie photo URLs) plus `data_processing_consent`, `consent_given_at`, `consent_document_url` — see "`clients`" above. All new profile columns are nullable; `data_processing_consent` is `NOT NULL DEFAULT false` but only *enforced* as required (via application logic, not a DB constraint) for interactively-created clients, not Excel imports.
- `client_references` — a new table for personal/comercial references, a dynamic add-many list per client. See "`client_references`" above.
- `loans` gained an optional co-debtor (codeudor): `co_debtor_full_name`, `co_debtor_document_type`, `co_debtor_document_number`, `co_debtor_phone_number`, `co_debtor_address`, `co_debtor_relationship`, `co_debtor_id_document_url`. Belongs to the loan rather than the client because whether a given loan has one varies per loan; at most one per loan. See "`loans`" above.
- The pagaré-photo field proposed early in this phase's design was discarded — not implemented, not present in any table.
- Legal basis and reasoning: Ley Estatutaria 1581 de 2012 + Decreto 1377 de 2013 ("Habeas Data"). The business owner is the "responsable del tratamiento"; this software is at most an "encargado" acting on instruction. The client's own authorization must happen physically/in person — the `data_processing_consent` checkbox in the app is staff-entered evidence that the physical authorization occurred, not the authorization itself, and sensitive/biometric data (`selfie_image_url`) is never made mandatory anywhere in the app, per the law's own restriction on conditioning any activity on a titular supplying sensitive data. See `docs/phases/PHASE_21_CLIENT_PROFILE.md` for the full decision log.

## Related documents

- `GLOSSARY.md` — definitions of `pagaré`, `cuota`, `mora`, `refinanciación`, and other terms used above
- `ARCHITECTURE.md` — how these entities map to NestJS modules
