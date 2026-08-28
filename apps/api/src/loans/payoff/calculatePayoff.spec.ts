import { addDays, subDays } from 'date-fns';

import { ConceptCalculationType } from '../../interestConceptTypes/entities/interestConceptType.entity';

import { calculatePayoff } from './calculatePayoff';

import type { PayoffInstallmentInput } from './calculatePayoff';

function installment(
  overrides: Partial<PayoffInstallmentInput> = {},
): PayoffInstallmentInput {
  return {
    installmentId: 'inst-1',
    installmentNumber: 1,
    amount: 300000,
    principalPortion: 270000,
    dueDate: '2026-01-01',
    moratoryConcepts: [],
    ...overrides,
  };
}

describe('calculatePayoff', () => {
  it('applies concept charges and moratory interest for a single overdue installment', () => {
    const today = new Date('2026-01-11');
    const dueDate = subDays(today, 10).toISOString().slice(0, 10);

    const quote = calculatePayoff(
      [installment({ dueDate, amount: 300000, principalPortion: 270000 })],
      6,
      today,
    );

    // conceptsInterest = 300000 - 270000 = 30000
    // moratoryInterest = 300000 * 0.06 / 30 * 10 = 6000
    expect(quote.installments[0]).toMatchObject({
      interestApplied: 36000,
      principalApplied: 270000,
      totalDue: 306000,
    });
    expect(quote.totalInterestOwed).toBeCloseTo(36000, 6);
    expect(quote.totalPrincipalOwed).toBe(270000);
    expect(quote.totalDue).toBeCloseTo(306000, 6);
  });

  it('sums interest and principal across multiple overdue installments', () => {
    const today = new Date('2026-02-01');
    const overdueDate = subDays(today, 5).toISOString().slice(0, 10);

    const quote = calculatePayoff(
      [
        installment({
          installmentId: 'inst-1',
          installmentNumber: 1,
          dueDate: overdueDate,
          amount: 300000,
          principalPortion: 270000,
        }),
        installment({
          installmentId: 'inst-2',
          installmentNumber: 2,
          dueDate: overdueDate,
          amount: 300000,
          principalPortion: 270000,
        }),
      ],
      6,
      today,
    );

    expect(quote.installments).toHaveLength(2);
    expect(quote.totalPrincipalOwed).toBe(540000);
    // Each installment: conceptsInterest 30000 + moratory (300000*0.06/30*5=3000) = 33000
    expect(quote.totalInterestOwed).toBeCloseTo(66000, 6);
    expect(quote.totalDue).toBeCloseTo(606000, 6);
  });

  it('charges a not-yet-due installment only its principal, at face value, with zero interest', () => {
    const today = new Date('2026-01-01');
    const futureDate = addDays(today, 20).toISOString().slice(0, 10);

    const quote = calculatePayoff(
      [
        installment({
          dueDate: futureDate,
          amount: 300000,
          principalPortion: 270000,
        }),
      ],
      6,
      today,
    );

    expect(quote.installments[0]).toEqual({
      installmentId: 'inst-1',
      installmentNumber: 1,
      interestApplied: 0,
      principalApplied: 270000,
      totalDue: 270000,
    });
  });

  it('mixes an overdue and a future installment correctly in the same quote', () => {
    const today = new Date('2026-03-01');
    const overdueDate = subDays(today, 15).toISOString().slice(0, 10);
    const futureDate = addDays(today, 15).toISOString().slice(0, 10);

    const quote = calculatePayoff(
      [
        installment({
          installmentId: 'inst-overdue',
          installmentNumber: 1,
          dueDate: overdueDate,
          amount: 300000,
          principalPortion: 270000,
        }),
        installment({
          installmentId: 'inst-future',
          installmentNumber: 2,
          dueDate: futureDate,
          amount: 300000,
          principalPortion: 270000,
        }),
      ],
      6,
      today,
    );

    const overdue = quote.installments.find(
      (i) => i.installmentId === 'inst-overdue',
    );
    const future = quote.installments.find(
      (i) => i.installmentId === 'inst-future',
    );

    expect(overdue?.interestApplied).toBeGreaterThan(0);
    expect(future?.interestApplied).toBe(0);
    expect(future?.totalDue).toBe(270000);
    expect(quote.totalPrincipalOwed).toBe(540000);
  });

  it('charges an installment due exactly today its concept interest but zero moratory interest', () => {
    const today = new Date('2026-01-01');

    const quote = calculatePayoff(
      [
        installment({
          dueDate: '2026-01-01',
          amount: 300000,
          principalPortion: 270000,
        }),
      ],
      6,
      today,
    );

    // Matured (due today), so concepts interest (30000) applies, but
    // overdueDays is 0 so moratory interest is 0.
    expect(quote.installments[0].interestApplied).toBeCloseTo(30000, 6);
  });

  it('falls back to treating the whole amount as principal when principalPortion is null (pre-Phase-14 installments)', () => {
    const today = new Date('2026-01-11');
    const overdueDate = subDays(today, 10).toISOString().slice(0, 10);

    const quote = calculatePayoff(
      [
        installment({
          dueDate: overdueDate,
          amount: 300000,
          principalPortion: null,
        }),
      ],
      6,
      today,
    );

    // No concept charges possible without a principal/concept split, so
    // interestApplied is purely the moratory formula: 300000*0.06/30*10.
    expect(quote.installments[0].interestApplied).toBeCloseTo(6000, 6);
    expect(quote.installments[0].principalApplied).toBe(300000);
  });

  it('uses the installment-assigned moratory concepts instead of the legacy interestRate formula once at least one is present', () => {
    const today = new Date('2026-01-11');
    const dueDate = subDays(today, 10).toISOString().slice(0, 10);

    const quote = calculatePayoff(
      [
        installment({
          dueDate,
          amount: 300000,
          principalPortion: 270000,
          moratoryConcepts: [
            {
              name: 'Interés moratorio',
              calculationType: ConceptCalculationType.Percentage,
              value: 6,
            },
            {
              name: 'Gastos de cobranza',
              calculationType: ConceptCalculationType.FixedAmount,
              value: 5000,
            },
          ],
        }),
      ],
      // A different legacy rate, to prove it's ignored once concepts exist.
      99,
      today,
    );

    // conceptsInterest = 30000; moratory: 300000*0.06/30*10 (6000) + 5000
    // flat = 11000. Total interestApplied = 41000.
    expect(quote.installments[0].interestApplied).toBeCloseTo(41000, 6);
  });

  it('returns zeros for an empty installment list', () => {
    const quote = calculatePayoff([], 6, new Date('2026-01-01'));

    expect(quote).toEqual({
      installments: [],
      totalInterestOwed: 0,
      totalPrincipalOwed: 0,
      totalDue: 0,
    });
  });
});
