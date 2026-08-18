import { ConceptCalculationType } from '../interestConceptTypes/entities/interestConceptType.entity';
import {
  ConceptAssignment,
  generateAmortizationSchedule,
} from '../loans/amortization/generateSchedule';

import { calculateMaxEffectiveInstallmentRate } from './calculateLoanEffectiveRate';

describe('calculateMaxEffectiveInstallmentRate', () => {
  it('returns a percentage concept value directly, unaffected by the declining balance', () => {
    const concept: ConceptAssignment = {
      conceptTypeId: 'concept-1',
      name: 'Interés remuneratorio',
      calculationType: ConceptCalculationType.Percentage,
      value: 3,
    };
    const schedule = generateAmortizationSchedule(900000, 3, [concept]);

    // The concept's currency amount declines with the balance, but its
    // rate (3%) is identical on every installment — the max is just 3.
    expect(calculateMaxEffectiveInstallmentRate(schedule, 900000)).toBe(3);
  });

  it('converts a fixed-amount concept to an equivalent rate against the balance before that installment', () => {
    const concept: ConceptAssignment = {
      conceptTypeId: 'concept-1',
      name: 'Gastos de cobranza',
      calculationType: ConceptCalculationType.FixedAmount,
      value: 6000,
    };
    // Single installment: balance before it is the full principal.
    const schedule = generateAmortizationSchedule(300000, 1, [concept]);

    // 6000 / 300000 * 100 = 2%
    expect(calculateMaxEffectiveInstallmentRate(schedule, 300000)).toBe(2);
  });

  it('sums every concept on the same installment before comparing', () => {
    const percentageConcept: ConceptAssignment = {
      conceptTypeId: 'concept-1',
      name: 'Interés remuneratorio',
      calculationType: ConceptCalculationType.Percentage,
      value: 2,
    };
    const fixedConcept: ConceptAssignment = {
      conceptTypeId: 'concept-2',
      name: 'Gastos de cobranza',
      calculationType: ConceptCalculationType.FixedAmount,
      value: 3000,
    };
    // balance before the single installment = 300000; fixed concept rate
    // = 3000 / 300000 * 100 = 1%; total = 2% + 1% = 3%.
    const schedule = generateAmortizationSchedule(300000, 1, [
      percentageConcept,
      fixedConcept,
    ]);

    expect(calculateMaxEffectiveInstallmentRate(schedule, 300000)).toBe(3);
  });

  it('picks the installment with the highest effective rate as the balance declines, not just the first', () => {
    // A fixed-amount concept's equivalent rate rises as the balance it's
    // divided against shrinks — concepts are fixed for the whole loan as
    // of the cuota fija correction (docs/phases/PHASE_14_INTEREST_CONCEPTS.md),
    // so this is the only way the effective rate still varies by
    // installment: 5000/300000=1.67%, 5000/200000=2.5%, 5000/100000=5%.
    const concept: ConceptAssignment = {
      conceptTypeId: 'concept-1',
      name: 'Gastos de cobranza',
      calculationType: ConceptCalculationType.FixedAmount,
      value: 5000,
    };
    const schedule = generateAmortizationSchedule(300000, 3, [concept]);

    expect(calculateMaxEffectiveInstallmentRate(schedule, 300000)).toBe(5);
  });

  it('returns 0 for a loan with no concepts at all', () => {
    const schedule = generateAmortizationSchedule(90000, 3, []);

    expect(calculateMaxEffectiveInstallmentRate(schedule, 90000)).toBe(0);
  });
});
