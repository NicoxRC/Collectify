# Glossary

This document defines the business vocabulary used throughout the codebase, database, and documentation. A term defined here should be used consistently everywhere. This version was revised after reviewing the client's real spreadsheets and WhatsApp message examples — it replaces earlier assumptions with confirmed business terms.

## Core entities

### Client
A person who has received one or more loans from the company. In code: `Client` entity, `clients` table. Identified by full name, national ID (`document_number`), and phone number.

### Cupo (credit limit)
The maximum credit exposure a client is allowed to carry at once. Optional — a client with no cupo set has no limit enforced. In code: `Client.credit_limit`, nullable.

**"Cupo usado" (credit used)** — confirmed with the client (Phase 10) to be capital plus interest accrued to date across the client's active loans' still-pending installments, i.e. the same `outstandingBalance` sum already computed per loan. Not stored; computed on read (`ClientsService.getCreditUsage`). A new loan is rejected if its principal would push the client past their available cupo (`creditLimit - creditUsed`).

**Mora block** — a client with any single installment more than 30 days overdue on an active loan cannot receive a new loan, regardless of remaining cupo. This is per-installment, not a client-aggregate rule (confirmed with the client, Phase 10) — one overdue cuota is enough, even if every other installment is current. See `docs/phases/PHASE_10_CLIENT_CAPACITY.md` and `DATABASE.md`'s "Changed after Phase 10".

### Loan / Pagaré
The Spanish business term is **pagaré** (promissory note) — this is what the client calls it in every message and spreadsheet, always referenced by number (e.g. "pagaré #743"). In code: `Loan` entity, `loans` table, with a `promissory_note_number` field holding this business-facing identifier (distinct from the internal UUID `id`).

A client can have multiple loans active simultaneously.

### Installment / Cuota
A single scheduled payment within a loan. A loan is divided into a fixed number of installments (`total_installments`), each with its **own due date and own amount** — installments are not always equal in amount, per real data. In code: `Installment` entity, `installments` table.

**This is the central unit of the business.** Overdue status, interest, and reminders all operate at the installment level, not the loan level.

**Cuota inicial (initial installment)** — added Phase 13: at most one installment per loan can be flagged as the initial/down payment, made at or near disbursement. It's not a scheduled repayment the client can be "late" on in the usual sense, so it's exempt from mora — it never accrues interest and never counts toward overdue KPIs or reminders, however far past its due date it is. It still must be paid: the amount owed is just the installment's own `amount`, with no interest ever added. In code: `Installment.isInitial`, boolean, defaults `false`. See `docs/phases/PHASE_13_INITIAL_INSTALLMENT.md`.

### Payment / Pago
A record of money received against a specific installment. An installment can receive multiple partial payments. In code: `Payment` entity, `payments` table.

**Comprobante (deposit receipt photo)** — added Phase 12: a payment can optionally carry a photo of the deposit/receipt, alongside its existing free-text `observation`. In code: `Payment.imageUrl`, nullable — the api only stores the URL, hosted externally (Cloudinary); it never receives the image bytes. See `docs/phases/PHASE_12_PAYMENT_ATTACHMENTS.md`.

## Status and mora

### Overdue (Mora / Vencido)
An installment whose `due_date` has passed without being fully paid. Calculated on read as `today - due_date`, never stored (see `DATABASE.md`). "Días de mora" = the number of days since the due date passed.

**Important:** overdue is a property of an *installment*, not a loan. A single loan can simultaneously have some installments overdue and others current.

### Días de mora
Literally "days of default" — the number of days an installment has been overdue. This exact phrase appears in both source spreadsheets as a column header (`DIAS MORA`) and is the number quoted directly to clients in reminder messages ("venció hace 45 días").

### Interest / Interés (mora interest)
The extra amount added to an overdue installment, calculated using this confirmed formula:

```
interest = installment_amount × (interest_rate / 100) / 30 × overdue_days
```

Confirmed by cross-checking multiple real examples in `LIBRO_PARA_COBRAR.xlsx` — the formula matches exactly. This is distinct from any interest that might be part of the original loan terms; this specifically refers to the penalty/mora interest accruing because a payment is late.

### Interest rate / Tasa de mora
The percentage used in the interest formula above. **Confirmed to vary per loan** in real data (values of 4%, 5%, and 6% found across loans, not cleanly tied to loan amount despite an informal rule the client mentioned). Current working assumption: this is a fixed value set manually per loan, editable, defaulting to a system-configured standard rate. **The exact business rule for how this rate is chosen or whether it changes over time is still pending confirmation with the client** — see the open questions in `DATABASE.md`.

**Changed after Phase 14:** this is now moratory-only — a loan's ordinary cost is priced entirely through interest concepts (see "Interest concept type" / "Interest concept" below) instead of this single rate. `interest_rate` still drives the mora formula above on overdue installments, unchanged in that role.

### Interest concept type / Tipo de concepto de interés
Added Phase 14 — an admin-managed, reusable definition of a kind of charge a loan can carry (e.g. "Interés remuneratorio", "Gastos de cobranza", "Uso de plataforma"): a name, a default calculation type (percentage or fixed amount), and an optional default value. The admin can create, edit, or deactivate these at any time — confirmed with the client this must never require a code change to add or reprice a concept. In code: `InterestConceptType` entity, `interest_concept_types` table. See `docs/phases/PHASE_14_INTEREST_CONCEPTS.md`.

### Interest concept / Concepto de interés
Added Phase 14 — one instance of an interest/fee concept applied to a specific installment, snapshotted from an `InterestConceptType` at the moment the loan's amortization schedule was generated (name, calculation type, value, and the resulting currency amount all copied at that point). Concepts can vary installment-to-installment within the same loan. Editing or deactivating the catalog type afterward never changes an already-created loan's numbers — this snapshot behavior is deliberate and confirmed with the client. In code: `LoanInstallmentConcept` entity, `loan_installment_concepts` table.

## Loan status

### Active
A loan with at least one installment not yet fully paid, not refinanced. In code: `status: 'active'` on `Loan`.

### Paid
A loan whose every installment has been fully paid. In code: `status: 'paid'`.

### Refinanced / Refinanciado
A loan that has been closed out and replaced by a new loan — typically because the client couldn't keep up with the original schedule and the remaining balance (plus accrued interest) was restructured into a new set of installments under a new *pagaré* number. Confirmed directly from real data (e.g. `REFINANCIADO #981`, `SE REFINANCIO EN EL #1000`). In code: `status: 'refinanced'`, with the new loan pointing back via `refinanced_from_loan_id`.

> This business does not use a "charged-off" concept (a loan formally written off as uncollectable). If that need arises later, it would be a new status and a new process to design, not something built preemptively.

## Communication

### Overdue reminder
The automated WhatsApp message sent weekly to a client, summarizing **every overdue installment across all of their loans** in a single message, ending with a grand total to pay. Confirmed from real message examples — this is not one message per loan or per installment, it's one consolidated message per client.

Example structure (from a real message, translated structurally):

```
[Client greeting]
1️⃣ Installment No. X of pagaré #Y for $Z (interest included) — overdue N days.
2️⃣ Installment No. X of pagaré #Y for $Z (interest included) — overdue N days.
[... one line per overdue installment ...]
The amount due today is $[grand total]
```

### New loan message / Mensaje de primera vez
Sent once, automatically, when a pagaré is created (or when a refinance creates a new one) — confirms the pagaré number, concept, effective date, and installment terms to the client. Unlike the overdue reminder, this is per-loan, not consolidated across a client's other loans, since it's announcing one specific new obligation. Added in Phase 9 — see `docs/phases/PHASE_9_MESSAGE_TYPES.md`.

### Upcoming due reminder / Aviso
The automated WhatsApp message sent as an installment approaches its due date, at a configurable set of day thresholds (default 5, 3, and 1 days before). Like the overdue reminder, it's consolidated **by client** across all their active loans. Unlike the overdue reminder, it has no grand total line (confirmed from the real "Aviso" message example) and doesn't include mora interest, since the installment isn't overdue yet. Added in Phase 9.

### Account summary / Estado de cuenta
An on-demand (not scheduled) WhatsApp message listing **every pending installment** for a client — both overdue and not-yet-due — across all their active loans, with a grand total. This is the "full statement" version of the overdue reminder: the overdue reminder only ever includes installments already in mora, while the account summary includes everything still owed. Added in Phase 9.

### Message template / Plantilla de mensaje
The fixed pattern used to generate a message. As of Phase 9, there is one template **per message type** (`new_loan`, `upcoming_due`, `overdue`, `account_summary`), not a single global template — `type` is unique, exactly one row per type. Because most of these messages include a **list** of installments (not just one value), the template needs to support a repeating block plus, for `overdue` and `account_summary`, a grand total — see `DATABASE.md` for the exact placeholder structure per type.

**Not admin-editable** (changed after Phase 9 — see `DATABASE.md` "Changed after Phase 9"): WhatsApp only allows a business-initiated message outside the 24h reply window through a template Meta has pre-approved (see `CONFIGURACION_WHATSAPP_META.md`), so a freely-editable `content` field in our own database would misrepresent what can actually be changed without breaking delivery. The admin can view the current template per type (`GET /message-templates`); changing the content is a migration, matching whatever Meta has approved.

### Message log
A historical record of a reminder actually sent to a client — one row per client per week it was sent, **not** one row per installment. In code: `MessageLog` entity, `message_logs` table.

### Message log item
A single installment's contribution to a sent message log — since one message covers several installments, this table records each one along with a **snapshot** of its overdue days and interest at the exact moment the message was sent (these values change daily, so the snapshot preserves what the client was actually told). In code: `MessageLogItem` entity, `message_log_items` table.

## Financial terms

### Principal amount / Monto principal
The total amount financed for a loan, before considering mora interest. Referred to as `TOTAL` or `SALDO TOTAL` in the source spreadsheets. In code: `principal_amount` on `Loan`.

### Disbursement / Desembolso
The act of giving the loan amount to the client. `disbursed_at` on the `Loan` entity.

### Installment frequency / Periodicidad
How often installments occur. Source data consistently shows `MENSUAL` (monthly); the system supports this as an enum in case other frequencies come up later.

### Tasa de usura / Usury rate
Added Phase 15 — Colombia's legal ceiling on lending cost, certified monthly by the Superintendencia Financiera de Colombia (calculated as 1.5× the "Interés Bancario Corriente"). A single global value in this system (does not vary by credit modality), admin-entered each month since there's no free official API for it. Enforced as a warning, not a hard block, at loan creation/refinance time only — comparing the loan's maximum per-installment effective rate (see "Interest concept" above) against the current ceiling. Non-retroactive: a new month's rate never changes interest already caused under a prior month's rate. In code: `UsuryRate` entity, `usury_rates` table (historical, append-only), `UsuryRateService`. See `docs/phases/PHASE_15_USURY_RATE.md` and `DATABASE.md`'s `usury_rates` section.

### Imputación del pago
Added Phase 16 — the Colombian Civil Code rule (Art. 1653) that when both interest and principal are owed, a payment settles interest first, and only the excess reduces principal — a client can never be forced to pay interest that hasn't been caused yet. Confirmed for this system: "interest" means moratory interest **and** every Phase 14 concept baked into an installment's `amount` (everything above `principalPortion`), not just moratory interest alone. See "Liquidación anticipada" below and `docs/phases/PHASE_16_EARLY_PAYOFF.md`.

### Liquidación anticipada / Early payoff
Added Phase 16 — closing a loan out today for less than the sum of its remaining installment totals would suggest, because future (not-yet-due) installments are charged at principal face value with zero interest — none has been caused yet. A separate, explicit action from an ordinary payment (confirmed with the human — `registerPayment` and its one-payment-per-installment behavior are untouched); always settles the full quoted amount, no partial early payoff. In code: `calculatePayoff()` (pure function, `loans/payoff/calculatePayoff.ts`), `GET /loans/:id/payoff-quote`, `POST /loans/:id/payoff`. See `docs/phases/PHASE_16_EARLY_PAYOFF.md`.

## Roles

### Owner (Admin)
The business owner. Full system access — manages clients, loans, installments, templates, users, and configuration.

### Collector / Cobrador
Both a business role and a system role. In the business, whoever follows up on overdue clients — could be the owner or a dedicated person. In the system, `role: 'collector'` — can view clients, loans, installments, and mora status, and trigger manual reminders, but has restricted access to system configuration (exact permission boundaries to be finalized during development — see `DATABASE.md` roles note).

## Administration

### Audit log
A record of who did a sensitive action, and when — creating/updating/ deactivating/reactivating clients, users, or loans, refinancing a loan, registering a payment. Added Phase 11 to give the business a real accountability trail instead of "nobody knows who registered this payment." In code: `AuditLog` entity, `audit_logs` table, written automatically by a globally-registered interceptor (`AuditLogInterceptor`) for any endpoint decorated with `@Audit(action, entityType)` — not logging calls hand-added to each service. Append-only, same convention as `message_logs`. See `docs/phases/PHASE_11_AUDIT_LOG.md` and `DATABASE.md`'s `audit_logs` section.

## Resolved from earlier analysis

The following were open questions in an earlier version of this glossary, now resolved after reviewing the client's real data:

- ~~Exact installment/payment schedule structure~~ → Confirmed: installments have individual due dates and (sometimes unequal) amounts.
- ~~Interest calculation method~~ → Confirmed formula, see above.
- ~~Additional client identification fields~~ → Confirmed: `document_number` (cédula) is required.

## Still open — pending client confirmation

- [ ] The exact rule governing `interest_rate` assignment or changes over time

## Resolved from Phase 6

- ~~What happens to a refinanced loan's remaining unpaid installments~~ → Confirmed: they're marked with a distinct `cancelled` status — excluded from active mora/reminder processing, but kept in the database as historical record. See `DATABASE.md` "Refinancing".

## Resolved from Phase 10

- ~~What counts toward "cupo usado" (credit used)~~ → Confirmed: capital + interest accrued to date, same basis as `outstandingBalance`. See "Cupo (credit limit)" above.
- ~~Whether the mora &gt; 30 days block is per-installment or client-aggregate~~ → Confirmed: per-installment — any single overdue installment blocks new loans for that client.

## Resolved from Phase 14

- ~~Whether concept types are a fixed/hardcoded list or an admin-managed catalog~~ → Confirmed: admin-managed catalog, extendable without a code change. See "Interest concept type" above.
- ~~Whether a loan's concepts must be identical across every installment~~ → Confirmed: concepts can vary installment-to-installment within the same loan.
- ~~Whether editing the concept-type catalog retroactively changes existing loans~~ → Confirmed: no — concepts are snapshotted per installment at generation time. See "Interest concept" above.

## Resolved from Phase 15

- ~~Whether the usury ceiling is a single global value or varies by credit modality~~ → Confirmed: single global value.
- ~~Whether the ceiling validates only nominal "interés" or the effective total cost~~ → Confirmed: the effective total cost — every Phase 14 concept plus moratory interest and fixed fees, not just a field literally named "interés." See "Tasa de usura" above.
- ~~On violation: hard block or warning~~ → Confirmed: a warning the admin can proceed past, optionally with a justification note.
- ~~Whether a rate change applies retroactively to interest already caused~~ → Confirmed: no, only forward from that point.

## Resolved from Phase 16

- ~~What counts as "interest" for imputación purposes~~ → Confirmed: moratory interest and every Phase 14 concept baked into an installment's `amount`, not just moratory interest alone. See "Imputación del pago" above.
- ~~Multi-installment allocation: waterfall vs. global~~ → Confirmed: interest-globally-then-principal-globally, though within this phase's full-payoff-only scope both produce the same numbers — recorded for Phase 17's reuse of `calculatePayoff()`.
- ~~Whether the payoff quote includes not-yet-due future installments~~ → Confirmed: yes, at principal face value with zero interest.
- ~~How an initial installment factors into the payoff~~ → Confirmed: only as principal, never interest.
- ~~Whether this becomes the new default behavior of every `registerPayment` call~~ → Confirmed: no — a separate, explicit "liquidar anticipadamente" flow for the full quoted amount only; `registerPayment` is untouched.

## Related documents

- `DATABASE.md` — how these terms map to actual tables and columns, including the confirmed interest formula
- `ARCHITECTURE.md` — where the business logic for these concepts lives in the codebase
