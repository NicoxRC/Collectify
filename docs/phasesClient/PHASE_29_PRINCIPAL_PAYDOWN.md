# Phase 29 — Principal Paydowns (Client)

## Goal

UI for registering a principal-only paydown against a loan. See `docs/phases/PHASE_29_PRINCIPAL_PAYDOWN.md`.

## Outcome

**No new UI was built.** Once the backend doc's open questions were resolved (2026-08-30/31), it turned out a principal paydown already had a UI path: it *is* a refinance, and `RefinanceLoanForm.tsx` has had an "Abono adicional a capital" field since Phase 17 that subtracts the paydown from the suggested principal before submitting.

A dedicated "Abono a capital" button on `LoanDetailPage.tsx` was considered and explicitly rejected — the action bar already has 6 buttons (Registrar pago, Liquidar anticipadamente, Editar, Cambiar estado, Refinanciar, Eliminar préstamo) and a 7th was judged too crowded for what the existing "Refinanciar" button + field already covers.

## Scope

- [x] `RefinanceLoanForm.tsx`: added helper text under "Abono adicional a capital" pointing the admin to the free-text "Descripción" field to note the paydown amount (e.g. "Abono a capital de $100.000"), so it's identifiable later on the new loan's detail page and in the `loan.refinance` audit log entry — both already rendered/captured that field before this change, so no new plumbing was needed.
- [x] Confirmed `LoanDetailPage.tsx` already links from a refinanced (old) loan to the new one ("Este préstamo fue refinanciado. Ver el préstamo nuevo: ..."), so the description is reachable from either side of a refinance chain without any new UI.

## Definition of done for this phase

- [x] An admin can register a principal-only paydown against a loan (via the existing refinance flow) and make it identifiable later via the description field.
- [x] All items in `docs/DEFINITION_OF_DONE.md` checklist pass — copy-only change, verified manually.

## Related documents

- `docs/phases/PHASE_29_PRINCIPAL_PAYDOWN.md` — backend-side reasoning this phase follows
- `docs/phasesClient/PHASE_6_REFINANCING.md`, `docs/phases/PHASE_17_REFINANCING_RECALC.md` — where the underlying "abono adicional a capital" field was actually built
