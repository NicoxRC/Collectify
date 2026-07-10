# Phase 4 — Loans and Installments (Backend)

## Goal
The core of the business domain. Loans (pagarés), divided into installments (cuotas), with payments tracked per installment and mora interest calculated correctly. **This is the most important phase — get the calculations exactly right.**

## Required reading before starting
`docs/DATABASE.md` (full "Business model overview" section and the `loans`/`installments`/`payments` table definitions) and `docs/GLOSSARY.md` (Pagaré, Cuota, Mora, Interest rate sections) are mandatory reading before writing any code in this phase. Do not skim them.

## Scope

### Entities and migrations
- [ ] `Loan` entity: `id`, `client_id` (FK), `promissory_note_number` (unique, indexed — this is the business-facing `#743` style identifier), `principal_amount`, `interest_rate`, `disbursed_at`, `installment_frequency` (enum: `monthly`, `biweekly`), `total_installments`, `status` (enum: `active`, `paid`, `refinanced`), `refinanced_from_loan_id` (nullable, self-referencing FK — implement the column now, but the actual refinancing *flow* is built in Phase 6), standard timestamps + soft delete
- [ ] `Installment` entity: `id`, `loan_id` (FK), `installment_number`, `amount`, `due_date`, `status` (enum: `pending`, `paid`), standard timestamps + soft delete
- [ ] `Payment` entity: `id`, `installment_id` (FK), `amount_paid`, `paid_at`, `observation` (nullable text), standard timestamps + soft delete
- [ ] Migrations for all three tables, in that order (loans → installments → payments), respecting foreign keys
- [ ] Indexes: `loans.promissory_note_number`, `installments.due_date`, `installments.status`, and all foreign keys — see `docs/DATABASE.md` → Indexes

### Core business logic — the overdue and interest calculation

This is the calculation that matters most. Implement it as a pure, well-isolated method — this is exactly the kind of logic `docs/TESTING.md` requires thorough test coverage for.

```typescript
// Confirmed formula — verified against real spreadsheet data, do not modify without re-verifying
function calculateOverdueDays(dueDate: Date, today: Date = new Date()): number {
  return today > dueDate ? differenceInDays(today, dueDate) : 0;
}

function calculateInterest(installmentAmount: number, interestRate: number, overdueDays: number): number {
  return installmentAmount * (interestRate / 100) / 30 * overdueDays;
}

function calculateTotalDue(installmentAmount: number, interest: number): number {
  return installmentAmount + interest;
}
```

- [ ] Implement these as methods on `InstallmentsService` (or a small dedicated calculation service if that's cleaner), fully unit tested with the exact numeric examples below.
- [ ] **Never store `overdue_days` or `interest` as columns** — these are always calculated on read, per `docs/DATABASE.md`.

**Verified test cases (from real data in the client's spreadsheet) — use these as literal test fixtures:**

| Installment amount | Interest rate | Overdue days | Expected interest | Expected total due |
|---|---|---|---|---|
| 210,000 | 6% | 740 | 310,800 | 520,800 |
| 520,000 | 6% | 484 | 503,360 | 1,023,360 |
| 547,000 | 6% | 409 | 447,446 | 994,446 |

If your implementation doesn't produce these exact numbers, the formula is wrong — stop and re-check before continuing.

### Installment generation

When a loan is created, its installments must be generated automatically based on `total_installments`, `installment_frequency`, and `disbursed_at`:

- [ ] `LoansService.create()` creates the `Loan` row, then generates `total_installments` `Installment` rows with sequential `installment_number` and `due_date` spaced according to `installment_frequency` (e.g. monthly = due date + 1 month per installment, starting from `disbursed_at`)
- [ ] Confirm with the human whether all installments must have equal `amount` (principal_amount / total_installments) or whether the API should accept custom per-installment amounts — real data shows some loans have unequal installment amounts. **Don't guess this — it's listed as an open question in `docs/DATABASE.md`.**

### Endpoints

- [ ] `GET /api/v1/loans` — paginated, filter by client, status
- [ ] `GET /api/v1/loans/:id` — detail, including its installments with calculated overdue days/interest
- [ ] `POST /api/v1/loans` — creates loan + generates installments
- [ ] `PATCH /api/v1/loans/:id` — limited fields (e.g. `interest_rate` — since it's manually editable per `docs/DATABASE.md`)
- [ ] `GET /api/v1/installments` — filter by loan, status, overdue-only
- [ ] `POST /api/v1/installments/:id/payments` — register a payment against an installment; if accumulated payments cover the installment amount, mark it `paid`; if all of a loan's installments are `paid`, mark the loan `paid`

### Tests (mandatory)

- [ ] `LoansService`: create with installment generation (verify correct count, due dates, amounts), find one, list with filters
- [ ] `InstallmentsService`: `calculateOverdueDays` (before due date, on due date, after due date), `calculateInterest` (using the verified fixtures above), `calculateTotalDue`, registering a payment (partial, full, overpayment edge case), marking installment/loan as paid when fully covered

### Swagger
- [ ] All endpoints documented, including that `GET /loans/:id` returns calculated (not stored) overdue/interest fields

## Definition of done for this phase

- A loan can be created and its installments are generated correctly
- The interest calculation matches the verified fixtures above exactly
- A payment against an installment correctly updates its status, and correctly cascades to the loan's status when appropriate
- All items in `docs/DEFINITION_OF_DONE.md` checklist pass

## Do not proceed to Phase 5 or 6 until

The installment amount-equality question above is resolved with the human, and the interest formula test fixtures pass exactly.
