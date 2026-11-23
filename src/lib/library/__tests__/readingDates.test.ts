import {
  datesForShelfChange,
  daysToRead,
  describeReadingDates,
  formatReadingDate,
  localDateString,
} from '../readingDates';

const TODAY = '2026-11-23';

describe('datesForShelfChange', () => {
  it('Start Reading logs today for a new or wanted book', () => {
    expect(datesForShelfChange(null, 'reading', TODAY)).toEqual({ startedAt: TODAY, finishedAt: null });
    expect(
      datesForShelfChange({ status: 'want_to_read', startedAt: null, finishedAt: null }, 'reading', TODAY),
    ).toEqual({ startedAt: TODAY, finishedAt: null });
  });

  it('Mark Finished logs today and keeps the start', () => {
    expect(
      datesForShelfChange({ status: 'reading', startedAt: '2026-11-01', finishedAt: null }, 'read', TODAY),
    ).toEqual({ startedAt: '2026-11-01', finishedAt: TODAY });
  });

  it('finishing without starting leaves the start unknown', () => {
    expect(datesForShelfChange(null, 'read', TODAY)).toEqual({ startedAt: null, finishedAt: TODAY });
    expect(
      datesForShelfChange({ status: 'want_to_read', startedAt: null, finishedAt: null }, 'read', TODAY),
    ).toEqual({ startedAt: null, finishedAt: TODAY });
  });

  it('undoing a mis-tapped Mark Finished keeps the real start date', () => {
    const reading = { status: 'reading' as const, startedAt: '2026-11-01', finishedAt: null };
    const finished = { status: 'read' as const, ...datesForShelfChange(reading, 'read', TODAY) };
    expect(datesForShelfChange(finished, 'reading', TODAY)).toEqual({ startedAt: '2026-11-01', finishedAt: null });
  });

  it('keeps an existing finish date when the book is already finished', () => {
    expect(
      datesForShelfChange({ status: 'read', startedAt: '2026-10-01', finishedAt: '2026-10-20' }, 'read', TODAY),
    ).toEqual({ startedAt: '2026-10-01', finishedAt: '2026-10-20' });
  });

  it('Want to Read clears both dates', () => {
    expect(
      datesForShelfChange({ status: 'read', startedAt: '2026-10-01', finishedAt: '2026-10-20' }, 'want_to_read', TODAY),
    ).toEqual({ startedAt: null, finishedAt: null });
  });
});

describe('local dates', () => {
  it('uses the local calendar day, not UTC', () => {
    // 11:30pm local on Nov 23 is still Nov 23, whatever the time zone.
    expect(localDateString(new Date(2026, 10, 23, 23, 30))).toBe('2026-11-23');
    expect(localDateString(new Date(2026, 0, 5, 0, 5))).toBe('2026-01-05');
  });

  it('counts days between start and finish, including across a DST change', () => {
    expect(daysToRead({ startedAt: '2026-11-01', finishedAt: '2026-11-23' })).toBe(22);
    expect(daysToRead({ startedAt: '2026-03-01', finishedAt: '2026-03-31' })).toBe(30);
    expect(daysToRead({ startedAt: null, finishedAt: '2026-11-23' })).toBeNull();
  });

  it('describes dates, leaving out the current year', () => {
    const now = new Date(2026, 10, 23);
    expect(formatReadingDate('2026-11-01', now)).toMatch(/Nov/);
    expect(formatReadingDate('2026-11-01', now)).not.toMatch(/2026/);
    expect(formatReadingDate('2025-12-31', now)).toMatch(/2025/);
    expect(describeReadingDates({ startedAt: '2026-11-01', finishedAt: '2026-11-23' }, now)).toMatch(
      /^Started .* · Finished .* · 22 days$/,
    );
    expect(describeReadingDates({ startedAt: '2026-11-23', finishedAt: '2026-11-23' }, now)).toMatch(/same day$/);
    expect(describeReadingDates({ startedAt: null, finishedAt: null }, now)).toBeNull();
  });
});
