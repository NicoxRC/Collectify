import { monthBoundaries } from './monthBoundaries';

describe('monthBoundaries', () => {
  it('returns the first and last day of a 31-day month', () => {
    expect(monthBoundaries(2026, 7)).toEqual({
      start: '2026-07-01',
      end: '2026-07-31',
    });
  });

  it('returns the first and last day of a 30-day month', () => {
    expect(monthBoundaries(2026, 4)).toEqual({
      start: '2026-04-01',
      end: '2026-04-30',
    });
  });

  it('handles February in a leap year', () => {
    expect(monthBoundaries(2028, 2)).toEqual({
      start: '2028-02-01',
      end: '2028-02-29',
    });
  });

  it('handles February in a non-leap year', () => {
    expect(monthBoundaries(2026, 2)).toEqual({
      start: '2026-02-01',
      end: '2026-02-28',
    });
  });
});
