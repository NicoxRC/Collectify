import { addDays, subDays } from 'date-fns';

import { ConceptCalculationType } from '../../interestConceptTypes/entities/interestConceptType.entity';

import {
  calculateDaysUntilDue,
  calculateInterest,
  calculateMoratoryCharges,
  calculateOverdueDays,
  calculateTotalDue,
} from './installmentCalculations';

describe('installmentCalculations', () => {
  describe('calculateOverdueDays', () => {
    it('returns 0 when the due date is today', () => {
      const dueDate = new Date();
      expect(calculateOverdueDays(dueDate, dueDate)).toBe(0);
    });

    it('returns 0 when the due date is in the future', () => {
      const today = new Date('2026-01-01');
      const dueDate = addDays(today, 5);
      expect(calculateOverdueDays(dueDate, today)).toBe(0);
    });

    it('returns the number of days elapsed when the due date has passed', () => {
      const today = new Date('2026-01-11');
      const dueDate = subDays(today, 10);
      expect(calculateOverdueDays(dueDate, today)).toBe(10);
    });

    it('is not off-by-one when the server runs behind UTC (dueDate is a UTC-midnight date string)', () => {
      // installments.dueDate is a 'date' column, parsed as UTC midnight —
      // this must give the same day count regardless of the machine's local
      // timezone. Regression test for a bug where differenceInCalendarDays
      // (which normalizes to LOCAL midnight) silently added a day in any
      // timezone behind UTC, e.g. America/Bogota (UTC-5).
      const dueDate = new Date('2024-01-01');
      const today = new Date('2024-01-11T08:00:00Z');
      expect(calculateOverdueDays(dueDate, today)).toBe(10);
    });
  });

  describe('calculateDaysUntilDue', () => {
    it('returns 0 when the due date is today', () => {
      const dueDate = new Date('2026-01-01');
      expect(calculateDaysUntilDue(dueDate, dueDate)).toBe(0);
    });

    it('returns 0 when the due date has already passed', () => {
      const today = new Date('2026-01-11');
      const dueDate = subDays(today, 10);
      expect(calculateDaysUntilDue(dueDate, today)).toBe(0);
    });

    it('returns the number of days remaining when the due date is in the future', () => {
      const today = new Date('2026-01-01');
      const dueDate = addDays(today, 5);
      expect(calculateDaysUntilDue(dueDate, today)).toBe(5);
    });
  });

  describe('calculateInterest — verified fixtures from real spreadsheet data', () => {
    it.each([
      [210000, 6, 740, 310800],
      [520000, 6, 484, 503360],
      [547000, 6, 409, 447446],
    ])(
      'amount=%d rate=%d%% overdueDays=%d -> interest=%d',
      (installmentAmount, interestRate, overdueDays, expectedInterest) => {
        expect(
          calculateInterest(installmentAmount, interestRate, overdueDays),
        ).toBeCloseTo(expectedInterest, 6);
      },
    );

    it('returns 0 when there are no overdue days', () => {
      expect(calculateInterest(210000, 6, 0)).toBe(0);
    });
  });

  describe('calculateMoratoryCharges', () => {
    it('matches calculateInterest exactly for a single percentage concept at the same rate — no regression when a loan migrates onto the new engine', () => {
      const [installmentAmount, rate, overdueDays, expected] = [
        210000, 6, 740, 310800,
      ];

      const result = calculateMoratoryCharges(installmentAmount, overdueDays, [
        {
          name: 'Interés moratorio',
          calculationType: ConceptCalculationType.Percentage,
          value: rate,
        },
      ]);

      expect(result[0].name).toBe('Interés moratorio');
      expect(result[0].amount).toBeCloseTo(expected, 6);
    });

    it('charges a fixed_amount concept in full, unscaled by overdueDays, once the installment is overdue', () => {
      const result = calculateMoratoryCharges(210000, 45, [
        {
          name: 'Gastos de cobranza',
          calculationType: ConceptCalculationType.FixedAmount,
          value: 15000,
        },
      ]);

      expect(result).toEqual([{ name: 'Gastos de cobranza', amount: 15000 }]);
    });

    it('every concept is 0 when the installment is not yet overdue', () => {
      const result = calculateMoratoryCharges(210000, 0, [
        {
          name: 'Interés moratorio',
          calculationType: ConceptCalculationType.Percentage,
          value: 6,
        },
        {
          name: 'Gastos de cobranza',
          calculationType: ConceptCalculationType.FixedAmount,
          value: 15000,
        },
      ]);

      expect(result).toEqual([
        { name: 'Interés moratorio', amount: 0 },
        { name: 'Gastos de cobranza', amount: 0 },
      ]);
    });

    it('sums multiple concepts independently, mixing percentage and fixed_amount', () => {
      const result = calculateMoratoryCharges(210000, 30, [
        {
          name: 'Interés moratorio',
          calculationType: ConceptCalculationType.Percentage,
          value: 6,
        },
        {
          name: 'Gastos de cobranza',
          calculationType: ConceptCalculationType.FixedAmount,
          value: 15000,
        },
      ]);

      // 210000 * 0.06 / 30 * 30 = 12600
      expect(result[0].amount).toBeCloseTo(12600, 6);
      expect(result[1].amount).toBe(15000);
    });

    it('returns an empty array when no moratory concepts are assigned', () => {
      expect(calculateMoratoryCharges(210000, 30, [])).toEqual([]);
    });
  });

  describe('calculateTotalDue — verified fixtures from real spreadsheet data', () => {
    it.each([
      [210000, 310800, 520800],
      [520000, 503360, 1023360],
      [547000, 447446, 994446],
    ])(
      'amount=%d interest=%d -> totalDue=%d',
      (installmentAmount, interest, expectedTotal) => {
        expect(calculateTotalDue(installmentAmount, interest)).toBeCloseTo(
          expectedTotal,
          6,
        );
      },
    );

    it('equals the installment amount when there is no interest', () => {
      expect(calculateTotalDue(210000, 0)).toBe(210000);
    });
  });
});
