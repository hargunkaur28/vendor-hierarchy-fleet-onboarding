import { differenceInCalendarDays, parseISO } from 'date-fns';

/**
 * Returns the number of calendar days until a date string expires from `now`.
 * Negative = already expired by that many days.
 * @complexity O(1)
 */
export function daysUntilExpiry(expiryDate: string, now: Date = new Date()): number {
  return differenceInCalendarDays(parseISO(expiryDate), now);
}

/** ISO string for today at midnight UTC */
export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/** ISO timestamp string for now */
export function nowISO(): string {
  return new Date().toISOString();
}
