// Converts between a friendly periodicity+time picker (what the admin
// actually interacts with — "cada día", "cada semana", "cada 15 días",
// "cada mes", plus an hour) and the cron expression the api's
// PATCH /whatsapp/cron/:type/schedule endpoint still expects. Added after
// client QA (2026-08-18): typing a raw cron expression was confirmed as
// too error-prone for day-to-day use — see
// docs/phasesClient/PHASE_18_MESSAGE_AUDIENCES.md.
//
// "Cada 15 días" has no native cron equivalent (cron only understands
// calendar fields, not a rolling N-day interval) — the closest practical
// approximation, and the one used here, is firing on the 1st and 16th of
// every month.

export type Periodicity = 'daily' | 'weekly' | 'biweekly' | 'monthly';

export interface ScheduleConfig {
  periodicity: Periodicity;
  hour: number; // 0-23
  minute: number; // 0-59
  // Only meaningful when periodicity is 'weekly'. 0 = Sunday, matching
  // cron's own day-of-week field.
  dayOfWeek: number;
  // Only meaningful when periodicity is 'monthly'. Capped at 1-28 so it's
  // always valid regardless of the month's actual length.
  dayOfMonth: number;
}

export const DEFAULT_SCHEDULE_CONFIG: ScheduleConfig = {
  periodicity: 'daily',
  hour: 9,
  minute: 0,
  dayOfWeek: 1,
  dayOfMonth: 1,
};

const BIWEEKLY_DAYS_OF_MONTH = '1,16';

export function buildCronExpression(config: ScheduleConfig): string {
  const minute = String(config.minute);
  const hour = String(config.hour);

  switch (config.periodicity) {
    case 'daily':
      return `${minute} ${hour} * * *`;
    case 'weekly':
      return `${minute} ${hour} * * ${config.dayOfWeek}`;
    case 'biweekly':
      return `${minute} ${hour} ${BIWEEKLY_DAYS_OF_MONTH} * *`;
    case 'monthly':
      return `${minute} ${hour} ${config.dayOfMonth} * *`;
  }
}

// Best-effort reverse parse — only recognizes expressions shaped exactly
// like something buildCronExpression() itself would produce. A
// hand-written expression from before this picker existed (e.g. the
// overdue reminder's original "0 9 * * 1,3,5", three weekdays at once) has
// no equivalent in this simplified model and returns null; the caller
// falls back to DEFAULT_SCHEDULE_CONFIG rather than guessing a lossy
// approximation.
export function parseCronExpression(
  expression: string | null | undefined,
): ScheduleConfig | null {
  if (!expression) return null;
  const parts = expression.trim().split(/\s+/);
  if (parts.length !== 5) return null;

  const [minuteStr, hourStr, dayOfMonthStr, monthStr, dayOfWeekStr] = parts;
  const minute = Number(minuteStr);
  const hour = Number(hourStr);
  if (
    !Number.isInteger(minute) ||
    minute < 0 ||
    minute > 59 ||
    !Number.isInteger(hour) ||
    hour < 0 ||
    hour > 23
  ) {
    return null;
  }
  if (monthStr !== '*') return null;

  if (dayOfMonthStr === '*' && dayOfWeekStr === '*') {
    return { ...DEFAULT_SCHEDULE_CONFIG, periodicity: 'daily', hour, minute };
  }
  if (dayOfMonthStr === '*' && /^[0-6]$/.test(dayOfWeekStr)) {
    return {
      ...DEFAULT_SCHEDULE_CONFIG,
      periodicity: 'weekly',
      hour,
      minute,
      dayOfWeek: Number(dayOfWeekStr),
    };
  }
  if (dayOfMonthStr === BIWEEKLY_DAYS_OF_MONTH && dayOfWeekStr === '*') {
    return {
      ...DEFAULT_SCHEDULE_CONFIG,
      periodicity: 'biweekly',
      hour,
      minute,
    };
  }
  if (/^([1-9]|1[0-9]|2[0-8])$/.test(dayOfMonthStr) && dayOfWeekStr === '*') {
    return {
      ...DEFAULT_SCHEDULE_CONFIG,
      periodicity: 'monthly',
      hour,
      minute,
      dayOfMonth: Number(dayOfMonthStr),
    };
  }

  return null;
}
