/** Pure book club rules: schedules, spoiler locks, progress, invites, calendar links. */

import { localDateString, parseLocalDate } from '@/lib/library/readingDates';

import type { Checkpoint, ClubPost, Meeting, Rsvp } from './types';

const addDays = (date: string, days: number) => {
  const d = parseLocalDate(date);
  d.setDate(d.getDate() + days);
  return localDateString(d);
};

/**
 * Split a book into weekly checkpoints. Open Library doesn't know chapter
 * counts, so stretches are page ranges when the page count is known
 * ("pp. 1–104"), else "Part 1", "Part 2"…
 */
export function makeSchedule(
  { startDate, weeks, pageCount }: { startDate: string; weeks: number; pageCount: number | null },
  makeId: (i: number) => string = (i) => `cp${i + 1}`,
): Checkpoint[] {
  const n = Math.max(1, Math.min(12, Math.round(weeks)));
  return Array.from({ length: n }, (_, i) => {
    let label = `Part ${i + 1}`;
    if (pageCount && pageCount >= n) {
      const from = Math.floor((pageCount * i) / n) + 1;
      const to = i === n - 1 ? pageCount : Math.floor((pageCount * (i + 1)) / n);
      label = i === n - 1 ? `pp. ${from}–end` : `pp. ${from}–${to}`;
    }
    return { id: makeId(i), label, dueDate: addDays(startDate, 7 * (i + 1) - 1) };
  });
}

/** Spoiler rule: a checkpoint's posts are visible once you've reached it. */
export const isUnlocked = (checkpointIndex: number, reached: number) => checkpointIndex <= reached;

/** Posts you can read, newest first (replies excluded; they appear in threads). */
export function visiblePosts(posts: readonly ClubPost[], checkpoints: readonly Checkpoint[], reached: number): ClubPost[] {
  const unlocked = new Set(checkpoints.filter((_, i) => isUnlocked(i, reached)).map((c) => c.id));
  return posts
    .filter((p) => p.parentId === null && unlocked.has(p.checkpointId))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Where the club is on its schedule today: index of the stretch due next, and overall progress (0–1). */
export function scheduleProgress(checkpoints: readonly Checkpoint[], startDate: string, today: string) {
  if (checkpoints.length === 0) return { current: 0, fraction: 0, week: 1, weeks: 0 };
  const start = parseLocalDate(startDate).getTime();
  const end = parseLocalDate(checkpoints[checkpoints.length - 1].dueDate).getTime() + 86_400_000;
  const now = parseLocalDate(today).getTime();
  const fraction = Math.max(0, Math.min(1, (now - start) / (end - start)));
  const idx = checkpoints.findIndex((c) => c.dueDate >= today);
  const current = idx === -1 ? checkpoints.length - 1 : idx;
  return { current, fraction, week: current + 1, weeks: checkpoints.length };
}

/** Invite code like "SNV-42K": letters from the club name, then a random part. */
export function makeInviteCode(name: string, random: () => number = Math.random): string {
  const letters = (name.toUpperCase().match(/[A-Z]/g) ?? ['C', 'L', 'B']).join('');
  const prefix = (letters.length >= 3 ? letters[0] + letters[Math.floor(letters.length / 2)] + letters[letters.length - 1] : letters.padEnd(3, 'X')).slice(0, 3);
  const alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // no 0/O or 1/I confusion
  const tail = Array.from({ length: 3 }, () => alphabet[Math.floor(random() * alphabet.length)]).join('');
  return `${prefix}-${tail}`;
}

export const normalizeCode = (code: string) => code.toUpperCase().replace(/[^A-Z0-9]/g, '');

/** The next meeting that hasn't ended. */
export function nextMeeting(meetings: readonly Meeting[], now: Date = new Date()): Meeting | null {
  const upcoming = meetings
    .filter((m) => new Date(m.endsAt).getTime() > now.getTime())
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  return upcoming[0] ?? null;
}

export function rsvpCounts(meeting: Meeting): Record<Rsvp, number> {
  const counts: Record<Rsvp, number> = { going: 0, maybe: 0, no: 0 };
  for (const r of Object.values(meeting.rsvps)) counts[r]++;
  return counts;
}

/** A pre-filled Google Calendar event link: works on any device without calendar permissions. */
export function calendarLink(m: Meeting, title: string, details: string): string {
  const fmt = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: title,
    dates: `${fmt(m.startsAt)}/${fmt(m.endsAt)}`,
    details: m.place.kind === 'video' ? `${details}\n\nJoin: ${m.place.url}` : details,
    location: m.place.kind === 'video' ? m.place.url : m.place.name,
  });
  return `https://calendar.google.com/calendar/render?${params}`;
}

/** Accept "zoom.us/j/123" as well as full links; reject anything that isn't a web link. */
export function normalizeMeetingUrl(input: string): string | null {
  const s = input.trim();
  if (!s) return null;
  const withScheme = /^https?:\/\//i.test(s) ? s : `https://${s}`;
  try {
    const u = new URL(withScheme);
    return u.hostname.includes('.') ? u.toString() : null;
  } catch {
    return null;
  }
}

/** "Thursday, Nov 26" and "7:00–8:00 pm". */
export function formatMeetingWhen(m: Meeting): { day: string; time: string } {
  const start = new Date(m.startsAt);
  const end = new Date(m.endsAt);
  const day = start.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
  const t = (d: Date) => d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  return { day, time: `${t(start)}–${t(end)}` };
}

/** "2h", "3d", "just now". */
export function timeAgo(iso: string, now: Date = new Date()): string {
  const s = Math.max(0, (now.getTime() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86_400) return `${Math.floor(s / 3600)}h`;
  if (s < 7 * 86_400) return `${Math.floor(s / 86_400)}d`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
