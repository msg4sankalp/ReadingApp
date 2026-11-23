/**
 * On-device book clubs for demo mode, with simulated members. State is one
 * JSON document in localStorage, like the demo library.
 */

import type { BookSearchResult } from '@/lib/books/openLibrary';
import { DEMO_BOOKS } from '@/lib/demo/seedData';
import type { KeyValueStorage } from '@/lib/demo/demoBackend';
import { localDateString } from '@/lib/library/readingDates';

import { makeInviteCode, makeSchedule, nextMeeting, normalizeCode } from './logic';
import type {
  Club,
  ClubBackend,
  ClubDetail,
  ClubMember,
  ClubPost,
  Meeting,
  NewClubInput,
  NewMeetingInput,
  Rsvp,
} from './types';

export const CLUBS_STORAGE_KEY = 'flip.clubs.v1';
export const ME = 'demo-user';
/** Try joining with this code in demo mode. */
export const DEMO_JOIN_CODE = 'FLIP-123';

interface ClubsState {
  version: 1;
  members: ClubMember[];
  clubs: Club[];
  posts: ClubPost[];
  meetings: Meeting[];
  /** clubId → furthest unlocked checkpoint index for the demo user. */
  reached: Record<string, number>;
  /** clubId → ISO time the demo user last opened the club. */
  seen: Record<string, string>;
  nextId: number;
}

const MEMBERS: ClubMember[] = [
  { id: ME, name: 'You', color: '#B85A38' },
  { id: 'maya', name: 'Maya', color: '#5E7F86' },
  { id: 'jon', name: 'Jon', color: '#7C9A5B' },
  { id: 'priya', name: 'Priya', color: '#8E6CB8' },
  { id: 'sam', name: 'Sam', color: '#C9A24E' },
  { id: 'ravi', name: 'Ravi', color: '#2E3B4E' },
  { id: 'lena', name: 'Lena', color: '#A0524F' },
];

const byTitle = (t: string) => DEMO_BOOKS.find((b) => b.title.startsWith(t))!;

export function createClubsSeed(now: Date = new Date()): ClubsState {
  const day = (offset: number) => {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
    return localDateString(d);
  };
  const at = (dayOffset: number, hour: number, minute = 0) =>
    new Date(now.getFullYear(), now.getMonth(), now.getDate() + dayOffset, hour, minute).toISOString();
  const ago = (hours: number) => new Date(now.getTime() - hours * 3_600_000).toISOString();

  // Sunday Novels: week 2 of 4 of Tomorrow, and Tomorrow, and Tomorrow.
  const tomorrow = byTitle('Tomorrow, and Tomorrow');
  const novelsStart = day(-9);
  const novelsCps = makeSchedule({ startDate: novelsStart, weeks: 4, pageCount: 416 }, (i) => `novels-cp${i + 1}`);
  // Sci-Fi Supper: nearly done with Piranesi.
  const piranesi = byTitle('Piranesi');
  const supperStart = day(-17);
  const supperCps = makeSchedule({ startDate: supperStart, weeks: 3, pageCount: 272 }, (i) => `supper-cp${i + 1}`);
  // A club you're not in yet: join it with DEMO_JOIN_CODE.
  const remains = byTitle('The Remains of the Day');
  const hourStart = day(-2);
  const hourCps = makeSchedule({ startDate: hourStart, weeks: 3, pageCount: 258 }, (i) => `hour-cp${i + 1}`);

  const clubs: Club[] = [
    {
      id: 'novels',
      name: 'Sunday Novels',
      code: 'SNV-42K',
      ownerId: ME,
      memberIds: [ME, 'maya', 'jon', 'priya'],
      current: { book: tomorrow, startDate: novelsStart, checkpoints: novelsCps },
      createdAt: ago(24 * 14),
    },
    {
      id: 'supper',
      name: 'Sci-Fi Supper',
      code: 'SFS-7QM',
      ownerId: 'sam',
      memberIds: ['sam', ME, 'ravi'],
      current: { book: piranesi, startDate: supperStart, checkpoints: supperCps },
      createdAt: ago(24 * 30),
    },
    {
      id: 'hour',
      name: 'The Quiet Hour',
      code: DEMO_JOIN_CODE,
      ownerId: 'lena',
      memberIds: ['lena', 'maya'],
      current: { book: remains, startDate: hourStart, checkpoints: hourCps },
      createdAt: ago(24 * 5),
    },
  ];

  let n = 0;
  const post = (clubId: string, checkpointId: string, authorId: string, body: string, hoursAgo: number, likes: string[] = [], parentId: string | null = null): ClubPost => ({
    id: `p${++n}`,
    clubId,
    checkpointId,
    authorId,
    body,
    createdAt: ago(hoursAgo),
    likes,
    parentId,
  });

  const posts: ClubPost[] = [];
  const p1 = post('novels', 'novels-cp1', 'jon', 'Sam and Sadie meeting in the hospital game room is such a perfect opening. Anyone else play Super Mario Bros. like that as a kid?', 150, ['maya', 'priya']);
  posts.push(
    p1,
    post('novels', 'novels-cp1', 'priya', 'Yes! And the way the friendship is framed as a kind of game from the very start.', 148, [ME], p1.id),
    post('novels', 'novels-cp1', 'maya', 'I love that each section feels like a different level. Zevin really commits to the metaphor.', 120, ['jon']),
  );
  const p2 = post('novels', 'novels-cp2', 'maya', 'The fallout between Sam and Sadie in this part wrecked me. Did anyone else think Sam was right?', 2, ['jon', 'priya', ME, 'sam']);
  posts.push(
    p2,
    post('novels', 'novels-cp2', 'priya', 'Team Sadie, always. Let’s fight about it on Thursday 😄', 1, ['maya', 'jon', ME], p2.id),
    post('novels', 'novels-cp2', 'jon', 'Adding it to the agenda.', 0.2, ['maya'], p2.id),
    post('novels', 'novels-cp2', 'jon', 'Loving how the structure mirrors a game: save points, restarts, different playthroughs. Zevin is doing something clever here.', 5, ['maya', 'priya']),
    post('novels', 'novels-cp3', 'priya', 'I did NOT see that coming. Saying nothing more until you’ve all caught up.', 3, ['maya']),
    post('novels', 'novels-cp3', 'maya', 'The chapter told in second person… I had to put the book down for a minute.', 1.5, ['priya']),
    post('supper', 'supper-cp1', 'sam', 'The House is such a strange, calm place to be. I keep picturing the statues.', 300, ['ravi', ME]),
    post('supper', 'supper-cp2', 'ravi', 'The way Piranesi talks about "the Other" makes so much more sense on a second read.', 60, ['sam']),
    post('supper', 'supper-cp3', 'sam', 'Okay, that ending. Bring snacks on Saturday, we need to talk.', 20, ['ravi']),
    post('hour', 'hour-cp1', 'lena', 'Stevens’ voice is so restrained it’s almost funny. I love him already.', 10, ['maya']),
  );

  const meetings: Meeting[] = [
    {
      id: 'm1',
      clubId: 'novels',
      startsAt: at(3, 19),
      endsAt: at(3, 20),
      place: { kind: 'video', url: 'https://zoom.us/j/81234567890' },
      checkpointId: 'novels-cp2',
      rsvps: { maya: 'going', jon: 'going', priya: 'maybe', [ME]: 'going' },
    },
    {
      id: 'm2',
      clubId: 'supper',
      startsAt: at(5, 18, 30),
      endsAt: at(5, 20, 30),
      place: { kind: 'place', name: 'Sam’s place' },
      checkpointId: 'supper-cp3',
      rsvps: { sam: 'going', ravi: 'going' },
    },
    {
      id: 'm3',
      clubId: 'hour',
      startsAt: at(9, 20),
      endsAt: at(9, 21),
      place: { kind: 'video', url: 'https://meet.google.com/abc-defg-hij' },
      checkpointId: 'hour-cp1',
      rsvps: { lena: 'going' },
    },
  ];

  return {
    version: 1,
    members: MEMBERS,
    clubs,
    posts,
    meetings,
    reached: { novels: 1, supper: 2 },
    seen: { novels: ago(24), supper: ago(1) },
    nextId: 100,
  };
}

function load(storage: KeyValueStorage | null, now: Date): ClubsState {
  const raw = storage?.getItem(CLUBS_STORAGE_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as ClubsState;
      if (parsed?.version === 1 && Array.isArray(parsed.clubs)) return parsed;
    } catch {
      // Fall back to a fresh seed.
    }
  }
  return createClubsSeed(now);
}

export type DemoClubBackend = ClubBackend & { reset(): void };

/**
 * Hand out copies, never the live state. Returning the same objects that later
 * get changed in place would make the data cache see "no change" and skip
 * re-rendering (an RSVP saved but the counts on screen stayed the same).
 */
const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

export function createDemoClubBackend(
  storage: KeyValueStorage | null,
  now: () => Date = () => new Date(),
  random: () => number = Math.random,
): DemoClubBackend {
  let state = load(storage, now());
  const save = () => storage?.setItem(CLUBS_STORAGE_KEY, JSON.stringify(state));
  const id = (prefix: string) => `${prefix}${state.nextId++}`;

  const clubOf = (clubId: string) => {
    const club = state.clubs.find((c) => c.id === clubId);
    if (!club) throw new Error('Club not found');
    return club;
  };
  const myClub = (clubId: string) => {
    const club = clubOf(clubId);
    if (!club.memberIds.includes(ME)) throw new Error('You’re not in this club');
    return club;
  };
  const membersOf = (club: Club) =>
    club.memberIds.map((mid) => state.members.find((m) => m.id === mid)).filter((m): m is ClubMember => Boolean(m));
  const reachedIn = (clubId: string) => state.reached[clubId] ?? 0;

  return {
    async listClubs() {
      return copy(state.clubs
        .filter((c) => c.memberIds.includes(ME))
        .map((club) => {
          const reached = reachedIn(club.id);
          const unlocked = new Set((club.current?.checkpoints ?? []).slice(0, reached + 1).map((c) => c.id));
          const seen = state.seen[club.id] ?? club.createdAt;
          const newPosts = state.posts.filter(
            (p) => p.clubId === club.id && p.authorId !== ME && unlocked.has(p.checkpointId) && p.createdAt > seen,
          ).length;
          return {
            club,
            members: membersOf(club),
            reached,
            nextMeeting: nextMeeting(state.meetings.filter((m) => m.clubId === club.id), now()),
            newPosts,
          };
        })
        .sort((a, b) => (a.nextMeeting?.startsAt ?? '9').localeCompare(b.nextMeeting?.startsAt ?? '9')));
    },

    async getClub(clubId): Promise<ClubDetail | null> {
      const club = state.clubs.find((c) => c.id === clubId && c.memberIds.includes(ME));
      if (!club) return null;
      return copy({
        club,
        members: membersOf(club),
        reached: reachedIn(clubId),
        posts: state.posts.filter((p) => p.clubId === clubId),
        meetings: state.meetings.filter((m) => m.clubId === clubId).sort((a, b) => a.startsAt.localeCompare(b.startsAt)),
      });
    },

    async markSeen(clubId) {
      state.seen[clubId] = now().toISOString();
      save();
    },

    async createClub({ name, book, weeks, startDate }: NewClubInput) {
      const trimmed = name.trim();
      if (!trimmed) throw new Error('Give your club a name');
      const clubId = id('club');
      const club: Club = {
        id: clubId,
        name: trimmed.slice(0, 60),
        code: makeInviteCode(trimmed, random),
        ownerId: ME,
        memberIds: [ME],
        current: {
          book: book as BookSearchResult,
          startDate,
          checkpoints: makeSchedule({ startDate, weeks, pageCount: book.pageCount }, (i) => `${clubId}-cp${i + 1}`),
        },
        createdAt: now().toISOString(),
      };
      state.clubs.push(club);
      state.reached[clubId] = 0;
      state.seen[clubId] = club.createdAt;
      save();
      return copy(club);
    },

    async joinClub(code) {
      const club = state.clubs.find((c) => normalizeCode(c.code) === normalizeCode(code));
      if (!club) throw new Error('No club found with that code. Check it and try again.');
      if (!club.memberIds.includes(ME)) club.memberIds.push(ME);
      state.reached[club.id] ??= 0;
      save();
      return copy(club);
    },

    async leaveClub(clubId) {
      const club = myClub(clubId);
      club.memberIds = club.memberIds.filter((m) => m !== ME);
      save();
    },

    async setReached(clubId, index) {
      const club = myClub(clubId);
      const max = (club.current?.checkpoints.length ?? 1) - 1;
      state.reached[clubId] = Math.max(0, Math.min(max, index));
      save();
    },

    async createPost(clubId, checkpointId, body, parentId) {
      const club = myClub(clubId);
      const text = body.trim();
      if (!text) throw new Error('Write something first');
      const index = club.current?.checkpoints.findIndex((c) => c.id === checkpointId) ?? -1;
      if (index < 0) throw new Error('Unknown checkpoint');
      if (index > reachedIn(clubId)) throw new Error('You haven’t reached that part yet');
      const p: ClubPost = {
        id: id('p'),
        clubId,
        checkpointId,
        authorId: ME,
        body: text.slice(0, 4000),
        createdAt: now().toISOString(),
        likes: [],
        parentId,
      };
      state.posts.push(p);
      save();
      return copy(p);
    },

    async toggleLike(postId) {
      const p = state.posts.find((x) => x.id === postId);
      if (!p) throw new Error('Post not found');
      myClub(p.clubId);
      p.likes = p.likes.includes(ME) ? p.likes.filter((m) => m !== ME) : [...p.likes, ME];
      save();
    },

    async deletePost(postId) {
      const p = state.posts.find((x) => x.id === postId);
      if (!p) return;
      const club = myClub(p.clubId);
      if (p.authorId !== ME && club.ownerId !== ME) throw new Error('You can only delete your own posts');
      state.posts = state.posts.filter((x) => x.id !== postId && x.parentId !== postId);
      save();
    },

    async scheduleMeeting({ clubId, startsAt, endsAt, place, checkpointId }: NewMeetingInput) {
      myClub(clubId);
      if (new Date(endsAt) <= new Date(startsAt)) throw new Error('The catch-up has to end after it starts');
      const m: Meeting = { id: id('m'), clubId, startsAt, endsAt, place, checkpointId, rsvps: { [ME]: 'going' } };
      state.meetings.push(m);
      save();
      return copy(m);
    },

    async rsvp(meetingId, response: Rsvp) {
      const m = state.meetings.find((x) => x.id === meetingId);
      if (!m) throw new Error('Catch-up not found');
      myClub(m.clubId);
      m.rsvps = { ...m.rsvps, [ME]: response };
      save();
    },

    async cancelMeeting(meetingId) {
      const m = state.meetings.find((x) => x.id === meetingId);
      if (!m) return;
      myClub(m.clubId);
      state.meetings = state.meetings.filter((x) => x.id !== meetingId);
      save();
    },

    reset() {
      state = createClubsSeed(now());
      save();
    },
  };
}
