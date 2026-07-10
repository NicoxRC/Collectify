import { addMonthsToDateString, addWeeksToDateString } from './dueDateSchedule';

describe('dueDateSchedule', () => {
  describe('addMonthsToDateString', () => {
    it('advances by the given number of months', () => {
      expect(addMonthsToDateString('2026-01-01', 1)).toBe('2026-02-01');
      expect(addMonthsToDateString('2026-01-01', 2)).toBe('2026-03-01');
      expect(addMonthsToDateString('2026-01-01', 3)).toBe('2026-04-01');
    });

    it('rolls over into the next year', () => {
      expect(addMonthsToDateString('2026-11-15', 3)).toBe('2027-02-15');
    });

    it('clamps to the last day of the target month instead of overflowing', () => {
      expect(addMonthsToDateString('2026-01-31', 1)).toBe('2026-02-28');
    });

    it('is not shifted by the server timezone (UTC-midnight date string in, UTC-midnight date string out)', () => {
      // Regression test: date-fns' addMonths + format shift this by a day
      // on any machine running behind UTC (e.g. America/Bogota) because
      // they read/write local-time getters against a UTC-midnight Date.
      expect(addMonthsToDateString('2026-01-01', 1)).toBe('2026-02-01');
    });
  });

  describe('addWeeksToDateString', () => {
    it('advances by the given number of weeks', () => {
      expect(addWeeksToDateString('2026-01-01', 2)).toBe('2026-01-15');
      expect(addWeeksToDateString('2026-01-01', 4)).toBe('2026-01-29');
    });

    it('rolls over across a month boundary', () => {
      expect(addWeeksToDateString('2026-01-01', 6)).toBe('2026-02-12');
    });
  });
});
