import { describe, expect, it } from 'vitest';

import {
  buildCronExpression,
  DEFAULT_SCHEDULE_CONFIG,
  parseCronExpression,
} from './cronScheduleUtils';

describe('buildCronExpression', () => {
  it('builds a daily expression', () => {
    expect(
      buildCronExpression({
        ...DEFAULT_SCHEDULE_CONFIG,
        periodicity: 'daily',
        hour: 8,
        minute: 30,
      }),
    ).toBe('30 8 * * *');
  });

  it('builds a weekly expression using dayOfWeek', () => {
    expect(
      buildCronExpression({
        ...DEFAULT_SCHEDULE_CONFIG,
        periodicity: 'weekly',
        hour: 9,
        minute: 0,
        dayOfWeek: 5,
      }),
    ).toBe('0 9 * * 5');
  });

  it('builds a biweekly expression as day-of-month 1 and 16', () => {
    expect(
      buildCronExpression({
        ...DEFAULT_SCHEDULE_CONFIG,
        periodicity: 'biweekly',
        hour: 7,
        minute: 15,
      }),
    ).toBe('15 7 1,16 * *');
  });

  it('builds a monthly expression using dayOfMonth', () => {
    expect(
      buildCronExpression({
        ...DEFAULT_SCHEDULE_CONFIG,
        periodicity: 'monthly',
        hour: 8,
        minute: 0,
        dayOfMonth: 20,
      }),
    ).toBe('0 8 20 * *');
  });
});

describe('parseCronExpression', () => {
  it('round-trips a daily expression', () => {
    const config = parseCronExpression('0 9 * * *');
    expect(config).toMatchObject({
      periodicity: 'daily',
      hour: 9,
      minute: 0,
    });
    expect(config && buildCronExpression(config)).toBe('0 9 * * *');
  });

  it('round-trips a weekly expression', () => {
    const config = parseCronExpression('0 8 * * 3');
    expect(config).toMatchObject({
      periodicity: 'weekly',
      hour: 8,
      minute: 0,
      dayOfWeek: 3,
    });
    expect(config && buildCronExpression(config)).toBe('0 8 * * 3');
  });

  it('round-trips a biweekly expression', () => {
    const config = parseCronExpression('0 8 1,16 * *');
    expect(config).toMatchObject({ periodicity: 'biweekly' });
    expect(config && buildCronExpression(config)).toBe('0 8 1,16 * *');
  });

  it('round-trips a monthly expression', () => {
    const config = parseCronExpression('0 8 1 * *');
    expect(config).toMatchObject({ periodicity: 'monthly', dayOfMonth: 1 });
    expect(config && buildCronExpression(config)).toBe('0 8 1 * *');
  });

  it('returns null for an expression outside the 4 supported shapes', () => {
    // The overdue reminder's original hand-written default — three
    // weekdays in one expression, which this simplified picker can't
    // represent.
    expect(parseCronExpression('0 9 * * 1,3,5')).toBeNull();
  });

  it('returns null for null/undefined/empty input', () => {
    expect(parseCronExpression(null)).toBeNull();
    expect(parseCronExpression(undefined)).toBeNull();
    expect(parseCronExpression('')).toBeNull();
  });

  it('returns null for a malformed expression', () => {
    expect(parseCronExpression('not a cron expression')).toBeNull();
  });
});
