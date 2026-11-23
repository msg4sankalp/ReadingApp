import type { KeyValueStorage } from '@/lib/demo/demoBackend';
import { DEMO_BOOKS } from '@/lib/demo/seedData';

import { CLUBS_STORAGE_KEY, createDemoClubBackend, DEMO_JOIN_CODE, ME } from '../demoClubs';
import { visiblePosts } from '../logic';

const memory = (): KeyValueStorage & { data: Map<string, string> } => {
  const data = new Map<string, string>();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v), removeItem: (k) => void data.delete(k) };
};
const NOW = new Date(2026, 10, 23, 12, 0);
const backend = (storage = memory()) => createDemoClubBackend(storage, () => NOW, () => 0.5);

describe('demo clubs', () => {
  it('lists the clubs you belong to, soonest catch-up first, with new-post counts', async () => {
    const clubs = await backend().listClubs();
    expect(clubs.map((c) => c.club.name)).toEqual(['Sunday Novels', 'Sci-Fi Supper']);
    expect(clubs[0].members.map((m) => m.name)).toEqual(['You', 'Maya', 'Jon', 'Priya']);
    expect(clubs[0].nextMeeting?.id).toBe('m1');
    // Only unlocked posts by others since you last looked count as new.
    expect(clubs[0].newPosts).toBe(4);
  });

  it('hides posts from checkpoints you have not reached', async () => {
    const b = backend();
    const detail = (await b.getClub('novels'))!;
    const visible = visiblePosts(detail.posts, detail.club.current!.checkpoints, detail.reached);
    expect(visible.some((p) => p.checkpointId === 'novels-cp3')).toBe(false);
    await b.setReached('novels', 2);
    const after = (await b.getClub('novels'))!;
    expect(visiblePosts(after.posts, after.club.current!.checkpoints, after.reached).some((p) => p.checkpointId === 'novels-cp3')).toBe(true);
  });

  it('refuses posts in locked checkpoints and clubs you are not in', async () => {
    const b = backend();
    await expect(b.createPost('novels', 'novels-cp4', 'Spoiler!', null)).rejects.toThrow(/haven’t reached/);
    await expect(b.createPost('hour', 'hour-cp1', 'Hi', null)).rejects.toThrow(/not in this club/);
    expect(await b.getClub('hour')).toBeNull();
  });

  it('joins with an invite code, ignoring case and dashes', async () => {
    const b = backend();
    await expect(b.joinClub('NOPE-000')).rejects.toThrow(/No club found/);
    const club = await b.joinClub(DEMO_JOIN_CODE.toLowerCase().replace('-', ''));
    expect(club.name).toBe('The Quiet Hour');
    expect((await b.listClubs()).map((c) => c.club.name)).toContain('The Quiet Hour');
  });

  it('creates a club with a weekly schedule and an invite code', async () => {
    const b = backend();
    const book = DEMO_BOOKS.find((x) => x.title === 'Dune')!;
    const club = await b.createClub({ name: 'Desert Readers', book, weeks: 3, startDate: '2026-11-23' });
    expect(club.code).toMatch(/^[A-Z]{3}-[2-9A-Z]{3}$/);
    expect(club.current!.checkpoints.map((c) => c.dueDate)).toEqual(['2026-11-29', '2026-12-06', '2026-12-13']);
    await expect(b.createClub({ name: '  ', book, weeks: 3, startDate: '2026-11-23' })).rejects.toThrow(/name/);
  });

  it('posts, replies, likes and deletes (with replies)', async () => {
    const b = backend();
    const post = await b.createPost('novels', 'novels-cp2', '  Great section!  ', null);
    expect(post.body).toBe('Great section!');
    const reply = await b.createPost('novels', 'novels-cp2', 'Agreed', post.id);
    await b.toggleLike(post.id);
    let posts = (await b.getClub('novels'))!.posts;
    expect(posts.find((p) => p.id === post.id)!.likes).toEqual([ME]);
    await b.toggleLike(post.id);
    await b.deletePost(post.id);
    posts = (await b.getClub('novels'))!.posts;
    expect(posts.some((p) => p.id === post.id || p.id === reply.id)).toBe(false);
    // Only your own posts (or as the club owner).
    await expect(b.deletePost('p10')).rejects.toThrow(/own posts/); // a Sci-Fi Supper post by Ravi; Sam owns that club
  });

  it('schedules catch-ups and records RSVPs', async () => {
    const b = backend();
    const m = await b.scheduleMeeting({
      clubId: 'novels',
      startsAt: '2026-12-01T19:00:00.000Z',
      endsAt: '2026-12-01T20:00:00.000Z',
      place: { kind: 'place', name: 'The library café' },
      checkpointId: 'novels-cp3',
    });
    expect(m.rsvps[ME]).toBe('going');
    await b.rsvp(m.id, 'maybe');
    expect((await b.getClub('novels'))!.meetings.find((x) => x.id === m.id)!.rsvps[ME]).toBe('maybe');
    await expect(
      b.scheduleMeeting({ ...m, clubId: 'novels', startsAt: m.endsAt, endsAt: m.startsAt }),
    ).rejects.toThrow(/end after it starts/);
  });

  it('returns copies, so cached data changes when the club does', async () => {
    const b = backend();
    const before = (await b.getClub('novels'))!;
    await b.rsvp('m1', 'maybe');
    const after = (await b.getClub('novels'))!;
    expect(before.meetings[0].rsvps[ME]).toBe('going'); // the earlier result wasn't changed underneath us
    expect(after.meetings[0].rsvps[ME]).toBe('maybe');
  });

  it('persists and resets', async () => {
    const storage = memory();
    await backend(storage).joinClub(DEMO_JOIN_CODE);
    expect(storage.data.has(CLUBS_STORAGE_KEY)).toBe(true);
    const again = backend(storage);
    expect((await again.listClubs()).length).toBe(3);
    again.reset();
    expect((await backend(storage).listClubs()).length).toBe(2);
  });
});
