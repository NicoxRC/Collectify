# Phase 16 — Early Payoff and Interest-First Allocation (Liquidación Anticipada)

## Goal

Let the system tell a client exactly how much they owe if they pay off their loan today, calculated correctly instead of simply summing remaining installment totals — Colombian law does not allow forcing a client to pay interest that hasn't been caused yet. This also generalizes to any payment that covers more than one overdue installment at once: interest owed is settled first, and only the remainder reduces principal.

## Domain research (informational — not a substitute for legal confirmation)

Colombian Civil Code, Article 1653 ("Imputación del pago a intereses"): if both principal and interest are owed, a payment is applied **first to accrued interest**, and only the excess to principal — unless the creditor expressly consents to apply it to principal directly. Worked example from the research: capital 100, interest 30, a payment of 50 pays the 30 of interest first, and the remaining 20 goes to principal. This is the general rule this phase implements, but the exact mechanics of applying it across multiple installments in one payment (see "Before starting" below) are a design decision, not something the law specifies at that level of detail.

## Before starting this phase — stop and confirm with the human

1. Confirm the allocation order precisely: interest first — does "interest" here mean moratory interest only, or the sum of all Phase 14 concepts? — then principal.
2. When one payment covers multiple overdue installments: waterfall per-installment (oldest installment's interest and principal fully resolved before moving to the next), or interest-first-globally-then-principal-globally across all pending installments? Both are legitimate readings of Article 1653 and produce different numbers.
3. Does the payoff quote include not-yet-due future installments (paying off the whole loan early), and if so, is future principal discounted at all, or charged at face value with zero future interest (since none has accrued yet)?
4. How does an initial installment (Phase 13, exempt from mora) factor into this calculation if it's still unpaid?
5. **Biggest question**: does this become the new default behavior of every `registerPayment` call (a single payment auto-splitting across multiple installments), or is it a separate, explicit "liquidar anticipadamente" flow that leaves today's one-payment-per-installment behavior untouched for ordinary partial payments? This determines whether `Payment.installment_id` needs to stop being a single required FK — a change with a large blast radius on the current data model.

**Do not pick answers and build it — ask the human.** This is a real financial calculation affecting real people's debts, exactly the category `CLAUDE.md` says never to guess.

## Required reading before starting

`docs/phases/PHASE_14_INTEREST_CONCEPTS.md`, `docs/phases/PHASE_15_USURY_RATE.md` (both feed into what "interest owed" means here), `docs/phases/PHASE_4_LOANS_INSTALLMENTS.md` (current `Payment`/`Installment` model).

## Scope (once the above is confirmed)

### Calculation module
- [ ] `loans/payoff/calculatePayoff.ts` — pure function implementing the confirmed allocation rule, sibling to `installmentCalculations.ts`, unit-tested the same way as `installmentCalculations.spec.ts`.

### Endpoint
- [ ] `GET /api/v1/loans/:id/payoff-quote` — returns the amount due today to close out the loan, with a breakdown per installment (interest applied, principal applied).
- [ ] Depending on the confirmed answer to question 5: either a new `POST /api/v1/loans/:id/payoff` endpoint that registers the correctly-split payments across multiple installments in one transaction, or a generalization of `registerPayment` to accept a payment spanning multiple installments.

### Tests (mandatory)
- [ ] `calculatePayoff()`: single overdue installment, multiple overdue installments, mix of overdue and not-yet-due, presence of an initial installment.
- [ ] The chosen endpoint correctly registers the resulting split payments and updates installment/loan status accordingly.

### Swagger
- [ ] New endpoint(s) documented, including a clear explanation of the allocation rule in the description.

## Definition of done for this phase

- A loan's payoff quote reflects interest owed to date, not blindly summing remaining installment totals.
- The confirmed allocation and scope-of-change answers are implemented exactly as agreed — not guessed.
- All items in `docs/DEFINITION_OF_DONE.md` checklist pass.

## After this phase

Update `docs/GLOSSARY.md` with "Liquidación anticipada / Early payoff" and "Imputación del pago", and `docs/DATABASE.md` if `Payment`'s relationship to `Installment` changed.

## Related documents

- `docs/phases/PHASE_14_INTEREST_CONCEPTS.md`, `docs/phases/PHASE_15_USURY_RATE.md` — feed the "interest owed" calculation
- `docs/phases/PHASE_17_REFINANCING_RECALC.md` — reuses this phase's calculation module
