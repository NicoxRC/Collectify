import { addDays, subDays } from 'date-fns';

import {
  calculateInterest,
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
