import type { CategorySlug } from '@/lib/catalog/categories';
import type { Bucket } from '@/lib/ranking';

import type { LibraryEntry, ReadingStatus } from '../types';
import { rankedGenres, rankedItems, shelfCounts, shelfEntries, unrankedEntries } from '../views';

let n = 0;
function entry(over: Partial<LibraryEntry> & { title?: string } = {}): LibraryEntry {
  n++;
  const { title, ...rest } = over;
  return {
    bookId: `b${n}`,
    status: 'read',
    category: null,
    bucket: null,
    rankPosition: null,
    score: null,
    chips: [],
    startedAt: null,
    finishedAt: null,
    updatedAt: `2026-11-${String(n).padStart(2, '0')}T00:00:00Z`,
    book: { title: title ?? `Book ${n}`, authors: [], coverUrl: null, openLibraryKey: null },
    ...rest,
  };
}
const ranked = (category: CategorySlug, bucket: Bucket, rankPosition: number, score: number, title?: string) =>
  entry({ category, bucket, rankPosition, score, title });
const shelved = (status: ReadingStatus, title?: string) => entry({ status, title });

describe('shelves', () => {
  it('counts each shelf and lists the newest first', () => {
    const a = shelved('want_to_read', 'A');
    const b = shelved('want_to_read', 'B');
    const entries = [a, b, shelved('reading'), ranked('sff', 'liked', 0, 10)];
    expect(shelfCounts(entries)).toEqual({ reading: 1, want_to_read: 2, read: 1 });
    expect(shelfEntries(entries, 'want_to_read').map((e) => e.book.title)).toEqual(['B', 'A']);
  });

  it('finds read books that are not ranked', () => {
    const unranked = shelved('read', 'Waiting');
    expect(unrankedEntries([unranked, ranked('sff', 'liked', 0, 10)]).map((e) => e.book.title)).toEqual(['Waiting']);
  });
});

describe('rankedGenres', () => {
  it('lists genres with ranked books, most first', () => {
    const entries = [
      ranked('history', 'liked', 0, 10),
      ranked('sff', 'liked', 0, 10),
      ranked('sff', 'fine', 0, 6.6),
      ranked('romance', 'liked', 0, 10),
      shelved('read'),
    ];
    expect(rankedGenres(entries).map((g) => [g.category.slug, g.count])).toEqual([
      ['sff', 2],
      ['romance', 1], // ties keep category order: romance before history
      ['history', 1],
    ]);
  });
});

describe('rankedItems', () => {
  const sff = [
    ranked('sff', 'fine', 1, 3.4, 'Fine 2'),
    ranked('sff', 'liked', 1, 6.7, 'Liked 2'),
    ranked('sff', 'disliked', 0, 3.3, 'Disliked 1'),
    ranked('sff', 'liked', 0, 10, 'Liked 1'),
    ranked('sff', 'fine', 0, 6.6, 'Fine 1'),
  ];

  it('groups a genre by bucket with continuous rank numbers', () => {
    const items = rankedItems(sff, 'sff');
    expect(items.map((i) => (i.kind === 'divider' ? `[${i.bucket}]` : `${i.rank}. ${i.entry.book.title}`))).toEqual([
      '[liked]',
      '1. Liked 1',
      '2. Liked 2',
      '[fine]',
      '3. Fine 1',
      '4. Fine 2',
      '[disliked]',
      '5. Disliked 1',
    ]);
  });

  it('marks scores provisional below 5 ranked books in the genre', () => {
    const small = [ranked('romance', 'liked', 0, 10)];
    const all = rankedItems([...sff, ...small], 'all');
    const byTitle = (t: string) => all.find((i) => i.kind === 'book' && i.entry.book.title === t);
    expect(byTitle('Liked 1')).toMatchObject({ provisional: false });
    expect(all.find((i) => i.kind === 'book' && i.entry.category === 'romance')).toMatchObject({ provisional: true });
  });

  it('sorts All by score with no dividers, ignoring unranked books', () => {
    const items = rankedItems([...sff, ranked('history', 'liked', 0, 9.5, 'History'), shelved('read')], 'all');
    expect(items.every((i) => i.kind === 'book')).toBe(true);
    expect(items.map((i) => (i.kind === 'book' ? `${i.rank}:${i.entry.score}` : ''))).toEqual([
      '1:10',
      '2:9.5',
      '3:6.7',
      '4:6.6',
      '5:3.4',
      '6:3.3',
    ]);
  });

  it('puts established scores before provisional ones when scores tie', () => {
    const lonelyRomance = ranked('romance', 'liked', 0, 10, 'Only romance');
    const items = rankedItems([lonelyRomance, ...sff], 'all');
    const titles = items.flatMap((i) => (i.kind === 'book' ? [i.entry.book.title] : []));
    // Both score 10.0; the Sci-Fi list has 5 books (established), Romance has 1 (provisional).
    expect(titles.slice(0, 2)).toEqual(['Liked 1', 'Only romance']);
  });

  it('returns nothing for a genre with no ranked books', () => {
    expect(rankedItems(sff, 'poetry')).toEqual([]);
  });
});
