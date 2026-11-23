/**
 * Start and finish dates. Dates are plain local calendar days ("YYYY-MM-DD"),
 * matching the `date` columns in the database: finishing a book at 11pm logs
 * today, not tomorrow in UTC.
 */

import type { ReadingStatus } from './types';

export interface ReadingDates {
  startedAt: string | null;
  finishedAt: string | null;
}

/** Today (or `now`) as a local calendar day, e.g. "2026-11-23". */
export function localDateString(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Dates after moving a book to a new shelf.
 *
 * - Start Reading logs today as the start, unless the book already has one.
 *   Keeping an existing start means undoing a mis-tapped "Mark Finished" keeps
 *   the real start date. (Re-reads will get their own history later.)
 * - Mark Finished logs today as the finish, unless the book is already finished.
 *   The start stays as it was, possibly unknown.
 * - Want to Read clears both.
 */
export function datesForShelfChange(
  current: ({ status: ReadingStatus } & ReadingDates) | null,
  next: ReadingStatus,
  today: string,
): ReadingDates {
  const started = current?.startedAt ?? null;
  const finished = current?.finishedAt ?? null;
  switch (next) {
    case 'want_to_read':
      return { startedAt: null, finishedAt: null };
    case 'reading':
      return { startedAt: started ?? today, finishedAt: null };
    case 'read':
      return { startedAt: started, finishedAt: current?.status === 'read' && finished ? finished : today };
  }
}

/** Parse "YYYY-MM-DD" as a local date (new Date("2026-11-23") would be UTC midnight). */
export function parseLocalDate(value: string): Date {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** "Nov 23, 2026"; the year is left out for dates in the current year. */
export function formatReadingDate(value: string, now: Date = new Date()): string {
  const date = parseLocalDate(value);
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    ...(date.getFullYear() === now.getFullYear() ? {} : { year: 'numeric' }),
  });
}

/** Whole days between start and finish, or null if either is unknown. */
export function daysToRead({ startedAt, finishedAt }: ReadingDates): number | null {
  if (!startedAt || !finishedAt) return null;
  const ms = parseLocalDate(finishedAt).getTime() - parseLocalDate(startedAt).getTime();
  return Math.round(ms / 86_400_000);
}

/** e.g. "Started Nov 1 · Finished Nov 23 · 22 days". */
export function describeReadingDates(dates: ReadingDates, now: Date = new Date()): string | null {
  const parts: string[] = [];
  if (dates.startedAt) parts.push(`Started ${formatReadingDate(dates.startedAt, now)}`);
  if (dates.finishedAt) parts.push(`Finished ${formatReadingDate(dates.finishedAt, now)}`);
  const days = daysToRead(dates);
  if (days !== null) parts.push(days === 0 ? 'same day' : days === 1 ? '1 day' : `${days} days`);
  return parts.length ? parts.join(' · ') : null;
}
