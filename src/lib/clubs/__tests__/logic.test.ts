import {
  calendarLink,
  isUnlocked,
  makeInviteCode,
  makeSchedule,
  nextMeeting,
  normalizeCode,
  normalizeMeetingUrl,
  rsvpCounts,
  scheduleProgress,
  timeAgo,
  visiblePosts,
} from '../logic';
import type { ClubPost, Meeting } from '../types';

describe('makeSchedule', () => {
  it('splits pages into weekly stretches', () => {
    expect(makeSchedule({ startDate: '2026-11-08', weeks: 4, pageCount: 416 })).toEqual([
      { id: 'cp1', label: 'pp. 1–104', dueDate: '2026-11-14' },
      { id: 'cp2', label: 'pp. 105–208', dueDate: '2026-11-21' },
      { id: 'cp3', label: 'pp. 209–312', dueDate: '2026-11-28' },
      { id: 'cp4', label: 'pp. 313–end', dueDate: '2026-12-05' },
    ]);
  });

  it('falls back to parts without a page count, and clamps the number of weeks', () => {
    expect(makeSchedule({ startDate: '2026-11-08', weeks: 2, pageCount: null }).map((c) => c.label)).toEqual([
      'Part 1',
      'Part 2',
    ]);
    expect(makeSchedule({ startDate: '2026-11-08', weeks: 40, pageCount: null })).toHaveLength(12);
    expect(makeSchedule({ startDate: '2026-11-08', weeks: 0, pageCount: 100 })).toHaveLength(1);
  });
});

describe('spoiler locks', () => {
  const checkpoints = makeSchedule({ startDate: '2026-11-08', weeks: 3, pageCount: 300 });
  const post = (id: string, cp: number, at: string, parentId: string | null = null): ClubPost => ({
    id,
    clubId: 'c',
    checkpointId: checkpoints[cp].id,
    authorId: 'm',
    body: id,
    createdAt: at,
    likes: [],
    parentId,
  });

  it('shows checkpoints up to the one you have reached', () => {
    expect([0, 1, 2].map((i) => isUnlocked(i, 1))).toEqual([true, true, false]);
  });

  it('lists visible top-level posts, newest first', () => {
    const posts = [
      post('a', 0, '2026-11-10T10:00:00Z'),
      post('b', 1, '2026-11-12T10:00:00Z'),
      post('c', 2, '2026-11-20T10:00:00Z'),
      post('reply', 1, '2026-11-13T10:00:00Z', 'b'),
    ];
    expect(visiblePosts(posts, checkpoints, 1).map((p) => p.id)).toEqual(['b', 'a']);
  });
});

describe('scheduleProgress', () => {
  const checkpoints = makeSchedule({ startDate: '2026-11-08', weeks: 4, pageCount: 400 });
  it('finds the current stretch and overall progress', () => {
    expect(scheduleProgress(checkpoints, '2026-11-08', '2026-11-18')).toMatchObject({ current: 1, week: 2, weeks: 4 });
    expect(scheduleProgress(checkpoints, '2026-11-08', '2026-11-08').fraction).toBe(0);
    expect(scheduleProgress(checkpoints, '2026-11-08', '2027-01-01')).toMatchObject({ current: 3, fraction: 1 });
  });
});

describe('invites', () => {
  it('makes readable codes from the club name', () => {
    let i = 0;
    const seq = [0.0, 0.5, 0.99];
    expect(makeInviteCode('Sunday Novels', () => seq[i++ % 3])).toMatch(/^[A-Z]{3}-[2-9A-Z]{3}$/);
    expect(makeInviteCode('Sunday Novels', () => 0)).toBe('SNS-222');
  });

  it('matches codes regardless of case and dashes', () => {
    expect(normalizeCode(' flip-123 ')).toBe('FLIP123');
  });
});

describe('meetings', () => {
  const meeting = (id: string, start: string, end: string): Meeting => ({
    id,
    clubId: 'c',
    startsAt: start,
    endsAt: end,
    place: { kind: 'video', url: 'https://zoom.us/j/1' },
    checkpointId: null,
    rsvps: { a: 'going', b: 'going', c: 'maybe' },
  });

  it('finds the next meeting that has not ended', () => {
    const now = new Date('2026-11-23T12:00:00Z');
    const past = meeting('past', '2026-11-20T19:00:00Z', '2026-11-20T20:00:00Z');
    const live = meeting('live', '2026-11-23T11:30:00Z', '2026-11-23T12:30:00Z');
    const later = meeting('later', '2026-11-26T19:00:00Z', '2026-11-26T20:00:00Z');
    expect(nextMeeting([later, past, live], now)?.id).toBe('live');
    expect(nextMeeting([past], now)).toBeNull();
  });

  it('counts RSVPs', () => {
    expect(rsvpCounts(meeting('m', '2026-11-26T19:00:00Z', '2026-11-26T20:00:00Z'))).toEqual({ going: 2, maybe: 1, no: 0 });
  });

  it('builds a calendar link with the video link included', () => {
    const url = new URL(calendarLink(meeting('m', '2026-11-26T19:00:00Z', '2026-11-26T20:00:00Z'), 'Sunday Novels', 'Discuss pp. 105–208'));
    expect(url.hostname).toBe('calendar.google.com');
    expect(url.searchParams.get('dates')).toBe('20261126T190000Z/20261126T200000Z');
    expect(url.searchParams.get('details')).toContain('Join: https://zoom.us/j/1');
  });

  it('accepts bare meeting links and rejects junk', () => {
    expect(normalizeMeetingUrl('zoom.us/j/8123')).toBe('https://zoom.us/j/8123');
    expect(normalizeMeetingUrl('https://meet.google.com/abc-defg-hij')).toBe('https://meet.google.com/abc-defg-hij');
    expect(normalizeMeetingUrl('not a link')).toBeNull();
    expect(normalizeMeetingUrl('')).toBeNull();
  });
});

describe('timeAgo', () => {
  const now = new Date('2026-11-23T12:00:00Z');
  it('describes recent times briefly', () => {
    expect(timeAgo('2026-11-23T11:59:30Z', now)).toBe('just now');
    expect(timeAgo('2026-11-23T11:20:00Z', now)).toBe('40m');
    expect(timeAgo('2026-11-23T09:00:00Z', now)).toBe('3h');
    expect(timeAgo('2026-11-20T12:00:00Z', now)).toBe('3d');
  });
});
