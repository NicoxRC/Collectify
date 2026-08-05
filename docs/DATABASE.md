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

`clients`, `loans`, `installments`, `payments`, `message_templates`, `message_logs`, `message_log_items`, `users`, `audit_logs`.

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

### `clients`

| Column | Type | Notes |
|---|---|---|
| `id` | UUID | PK |
| `first_name` | VARCHAR | |
| `last_name` | VARCHAR | |
| `document_number` | VARCHAR | national ID (cédula) — confirmed required, present in both source spreadsheets as `DOCUMENTO` |
| `phone_number` | VARCHAR | E.164 format, e.g. `+573001234567` |
| `credit_limit` | DECIMAL(12,2), nullable | maximum credit exposure ("cupo") enforced at loan creation. Nullable — unset means no cupo is enforced for this client, same "absence of a value means the rule doesn't apply" convention as `loans.description`. Added Phase 10, see "Changed after Phase 10" below. |
| `created_at`, `updated_at`, `deleted_at` | TIMESTAMPTZ | standard |

**Changed after Phase 10 — cupo and mora-block rules confirmed with the client:**
- **"Cupo usado" (credit used)** = capital + interest accrued to date across the client's *active* loans' still-pending installments — the same `totalDue`-based sum already computed per loan as `outstandingBalance` (see `loans` below), just aggregated across every active loan instead of one. Refinanced-away and paid-off loans don't count (their `status` is no longer `active`). Not a stored column — computed on read by `ClientsService.getCreditUsage`/`findOneDetail`, exposed as `creditUsed`/`creditAvailable` on `GET /clients/:id`.
- **Mora block (+30 days)** is per-installment, not client-aggregate: a client is blocked from new loans as soon as *any single* pending installment across their active loans is more than 30 days overdue — not an average or the oldest one specifically. Computed on read by `ClientsService.hasMoraBlock`, exposed as `isMoraBlocked` on `GET /clients/:id`.
- Both are checked by `LoansService.create()` before a new loan is persisted, reported as two distinct rejection reasons (over cupo vs. mora-blocked) — see `docs/phases/PHASE_10_CLIENT_CAPACITY.md`.

### `loans`

Represents a *pagaré* — see `GLOSSARY.md`.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID | PK (internal) |
| `client_id` | UUID | FK → `clients.id` |
| `promissory_note_number` | VARCHAR | **the business-facing identifier** — this is the `#743`, `#959` etc. seen in client messages and spreadsheets. Not the same as `id`. Must be unique and searchable. |
| `principal_amount` | DECIMAL(12,2) | total amount financed (`TOTAL` / `SALDO TOTAL` in the source sheets) |
| `interest_rate` | DECIMAL(5,2) | percentage, **fixed and manually editable per loan** — see note below |
| `disbursed_at` | DATE | when the loan was given (`FECHA INICIAL`) |
| `installment_frequency` | ENUM (`monthly`, `biweekly`) | source data shows `MENSUAL` consistently; enum leaves room for other frequencies if they come up |
| `total_installments` | INT | total number of installments the loan is divided into (`CUOTAS`) |
| `status` | ENUM (`active`, `paid`, `refinanced`) | see `GLOSSARY.md` — **no `overdue` status at the loan level**, since overdue is an installment-level concept (see below) |
| `refinanced_from_loan_id` | UUID, nullable | self-referencing FK → `loans.id`. Set when this loan was created to replace an older one. See "Refinancing" below. |
| `description` | TEXT, nullable | free-text concept/reason for the loan (e.g. "Compra de Apple MacBook Air M5..."), used by the "new loan" WhatsApp message — see `docs/phases/PHASE_9_MESSAGE_TYPES.md`. Optional, same precedent as `payments.observation`. |
| `created_at`, `updated_at`, `deleted_at` | TIMESTAMPTZ | standard |

**On `interest_rate`:** confirmed from real data that the rate is **not** automatically tiered by amount, despite an informal rule mentioned by the client ("6% under 1 million, 5% over"). Actual historical data shows loans of the same amount range with rates of 4%, 5%, and 6%. The safest interpretation — **pending final confirmation with the client** — is that the rate is set manually per loan at creation time, defaulting to whatever the current standard rate is, but editable. Do not hardcode an automatic tiering rule based on this early analysis.

**On why there's no `status: 'overdue'` at the loan level:** a loan can have some installments overdue and others current, or even fully current with a future installment pending. "Overdue" is a derived state of an *installment*, not the loan as a whole. The loan's own dashboard/detail view aggregates its installments' statuses for display purposes but doesn't store a redundant "overdue" flag.

### `installments`

Represents a single *cuota* within a loan.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID | PK |
| `loan_id` | UUID | FK → `loans.id` |
| `installment_number` | INT | e.g. cuota 14 of 24 (`NO #` / `# DE CUOTAS` in source data) |
| `amount` | DECIMAL(12,2) | the installment's own amount (`VLR CUOTA`) — installments within a loan are not always equal, per real data |
| `due_date` | DATE | this installment's specific due date (`FECHA COBRO` / `FECHA CUOTA`) |
| `status` | ENUM (`pending`, `paid`, `cancelled`) | overdue is **calculated on read**, never stored — see below. `cancelled` is set when the parent loan is refinanced with this installment still pending — see "Refinancing" |
| `created_at`, `updated_at`, `deleted_at` | TIMESTAMPTZ | standard |

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
| `created_at`, `updated_at`, `deleted_at` | TIMESTAMPTZ | standard |

### `message_templates`

| Column | Type | Notes |
|---|---|---|
| `id` | UUID | PK |
| `name` | VARCHAR | |
| `type` | ENUM (`new_loan`, `upcoming_due`, `overdue`, `account_summary`), **UNIQUE** | which message flow this template renders — exactly one row per type, see `docs/phases/PHASE_9_MESSAGE_TYPES.md` |
| `content` | TEXT | supports placeholders — see below. **Not admin-editable — see "Changed after Phase 9" below.** |
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
| `created_at` | TIMESTAMPTZ | append-only, no `updated_at`/`deleted_at` |

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

- Every foreign key (`client_id`, `loan_id`, `installment_id`, `message_log_id`, `actor_user_id`)
- `loans.promissory_note_number` — looked up constantly, must be fast and unique
- `clients.document_number` — for search and duplicate prevention
- `clients.phone_number` — for search and WhatsApp matching
- `installments.due_date` and `installments.status` — the weekly CronJob queries heavily on both
- `audit_logs (entity_type, entity_id)` and `audit_logs (actor_user_id, created_at)` — back "show me the history for this record" and "show me what this user did, most recent first", the two filters the audit log screen supports (see `docs/phasesClient/PHASE_11_AUDIT_LOG.md`)

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

## Related documents

- `GLOSSARY.md` — definitions of `pagaré`, `cuota`, `mora`, `refinanciación`, and other terms used above
- `ARCHITECTURE.md` — how these entities map to NestJS modules
