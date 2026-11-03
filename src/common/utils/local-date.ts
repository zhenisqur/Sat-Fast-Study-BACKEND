// "Today" must follow the user's local calendar day, not UTC: for UTC+5 a UTC
// day boundary would roll the daily goal/streak over at 05:00 local time.
export const DEFAULT_TIMEZONE = process.env.DEFAULT_TIMEZONE || 'Asia/Almaty';

export function isValidTimezone(tz: string | undefined | null): tz is string {
  if (!tz) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** Local calendar date in `tz`, as a UTC-midnight Date (fits Prisma @db.Date columns). */
export function localDate(tz: string | undefined | null = DEFAULT_TIMEZONE, now: Date = new Date()): Date {
  const zone = isValidTimezone(tz) ? tz : DEFAULT_TIMEZONE;
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const get = (type: string) => Number(parts.find((p) => p.type === type)!.value);
  return new Date(Date.UTC(get('year'), get('month') - 1, get('day')));
}

/** Whole days between two UTC-midnight dates (b - a). */
export function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}
