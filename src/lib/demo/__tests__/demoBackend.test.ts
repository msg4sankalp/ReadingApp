import type { BookSearchResult } from '@/lib/books/openLibrary';
import { runInsertion } from '@/lib/ranking';

import { createDemoBackend, DEMO_STORAGE_KEY, type KeyValueStorage } from '../demoBackend';
import { DEMO_BOOKS, DEMO_RANKINGS } from '../seedData';

function memoryStorage(): KeyValueStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
}

const newBook: BookSearchResult = {
  openLibraryKey: '/works/OL999W',
  title: 'A New Book',
  subtitle: null,
  authors: ['Someone'],
  coverUrl: null,
  firstPublishYear: 2024,
  pageCount: 300,
  isbn13: null,
  subjects: ['Science fiction'],
  suggestedCategory: 'sff',
};

const SFF_LIKED = DEMO_RANKINGS.find((l) => l.category === 'sff' && l.bucket === 'liked')!.books;

describe('seed data', () => {
  it('references only books that exist, each in one list', () => {
    const keys = new Set(DEMO_BOOKS.map((b) => b.openLibraryKey));
    const ranked = DEMO_RANKINGS.flatMap((l) => l.books);
    expect(ranked.every((k) => keys.has(k))).toBe(true);
    expect(new Set(ranked).size).toBe(ranked.length);
  });

  it('loads with scores derived from positions', async () => {
    const backend = createDemoBackend(memoryStorage());
    const library = await backend.fetchLibrary();
    const hailMary = library.find((e) => e.bookId === SFF_LIKED[0])!;
    expect(hailMary.score).toBe(9.7); // #1 of 5 liked
    const hobbit = library.find((e) => e.bookId === SFF_LIKED[SFF_LIKED.length - 1])!;
    expect(hobbit.score).toBe(7); // #5 of 5 liked
  });
});

describe('ranking', () => {
  it('inserts a new book, shifts the list and keeps relevant comparisons', async () => {
    const backend = createDemoBackend(memoryStorage());
    const id = await backend.ensureBook(newBook);
    const list = (await backend.fetchRankedList('sff', 'liked')).map((b) => b.bookId);

    // A reader who puts the new book second.
    const truth = [list[0], id, ...list.slice(1)];
    const result = runInsertion(id, list, (n, o) => (truth.indexOf(n) < truth.indexOf(o) ? 'new' : 'existing'));
    const unrelated = { winner: list[0], loser: list[1] };

    const score = await backend.rankBook({
      bookId: id,
      category: 'sff',
      bucket: 'liked',
      position: result.position,
      comparisons: [...result.comparisons, unrelated],
    });

    expect((await backend.fetchRankedList('sff', 'liked')).map((b) => b.bookId)).toEqual(truth);
    expect(score).toBe(9.2); // #2 of 6: 10 - (1.5 / 6) * 3.3 = 9.175
    const snapshot = backend.snapshot();
    expect(snapshot.comparisons).toHaveLength(result.comparisons.length);
    expect(snapshot.entries[id].status).toBe('read');
  });

  it('moves a book between lists and closes the gap it leaves', async () => {
    const backend = createDemoBackend(memoryStorage());
    const dune = SFF_LIKED[3];
    await backend.rankBook({ bookId: dune, category: 'sff', bucket: 'fine', position: 0, comparisons: [] });

    const liked = (await backend.fetchRankedList('sff', 'liked')).map((b) => b.bookId);
    expect(liked).toEqual(SFF_LIKED.filter((k) => k !== dune));
    const snapshot = backend.snapshot();
    liked.forEach((k, i) => expect(snapshot.entries[k].position).toBe(i));
    expect((await backend.fetchRankedList('sff', 'fine'))[0].bookId).toBe(dune);
  });

  it('rejects out-of-range positions and unknown books', async () => {
    const backend = createDemoBackend(memoryStorage());
    await expect(
      backend.rankBook({ bookId: SFF_LIKED[0], category: 'history', bucket: 'liked', position: 9, comparisons: [] }),
    ).rejects.toThrow(/out of range/);
    await expect(
      backend.rankBook({ bookId: '/works/OL0W', category: 'sff', bucket: 'liked', position: 0, comparisons: [] }),
    ).rejects.toThrow(/Unknown book/);
  });

  it('moving a ranked book off the Read shelf unranks it', async () => {
    const backend = createDemoBackend(memoryStorage());
    const book = DEMO_BOOKS.find((b) => b.openLibraryKey === SFF_LIKED[0])!;
    await backend.setShelf(book, 'reading');
    const entry = (await backend.fetchEntryForWork(book.openLibraryKey))!;
    expect(entry).toMatchObject({ status: 'reading', bucket: null, rankPosition: null, score: null });
    expect((await backend.fetchRankedList('sff', 'liked')).map((b) => b.bookId)).toEqual(SFF_LIKED.slice(1));
  });
});

describe('reading dates', () => {
  it('logs start and finish dates through the shelf lifecycle', async () => {
    let clock = new Date(2026, 10, 1, 9, 0);
    const backend = createDemoBackend(memoryStorage(), () => clock);

    await backend.setShelf(newBook, 'want_to_read');
    expect(await backend.fetchEntryForWork(newBook.openLibraryKey)).toMatchObject({ startedAt: null, finishedAt: null });

    await backend.setShelf(newBook, 'reading');
    expect(await backend.fetchEntryForWork(newBook.openLibraryKey)).toMatchObject({
      startedAt: '2026-11-01',
      finishedAt: null,
    });

    clock = new Date(2026, 10, 23, 23, 30); // late evening: still the 23rd locally
    await backend.setShelf(newBook, 'read');
    await backend.rankBook({ bookId: newBook.openLibraryKey, category: 'sff', bucket: 'liked', position: 0, comparisons: [] });
    expect(await backend.fetchEntryForWork(newBook.openLibraryKey)).toMatchObject({
      startedAt: '2026-11-01',
      finishedAt: '2026-11-23',
    });
  });

  it('saves edited dates', async () => {
    const backend = createDemoBackend(memoryStorage());
    await backend.setDates(SFF_LIKED[0], { startedAt: '2026-01-02', finishedAt: '2026-01-20' });
    expect(await backend.fetchEntryForWork(SFF_LIKED[0])).toMatchObject({ startedAt: '2026-01-02', finishedAt: '2026-01-20' });
    await expect(backend.setDates('/works/OL0W', { startedAt: null, finishedAt: null })).rejects.toThrow(/not in the library/);
  });

  it('seeds dates for the sample library', async () => {
    const library = await createDemoBackend(memoryStorage()).fetchLibrary();
    for (const e of library) {
      if (e.status === 'read') expect(e.finishedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      if (e.status === 'reading') expect(e.startedAt).not.toBeNull();
      if (e.status === 'want_to_read') expect([e.startedAt, e.finishedAt]).toEqual([null, null]);
      if (e.startedAt && e.finishedAt) expect(e.startedAt <= e.finishedAt).toBe(true);
    }
  });
});

describe('recommendation feedback', () => {
  it('remembers dismissed books across restarts', async () => {
    const storage = memoryStorage();
    await createDemoBackend(storage).recordFeedback(newBook, 'dismissed', 7.9);
    const again = createDemoBackend(storage);
    expect([...(await again.fetchDismissed())]).toEqual([newBook.openLibraryKey]);
    await again.recordFeedback({ ...newBook, openLibraryKey: '/works/OL998W' }, 'want_to_read', 8.1);
    expect((await again.fetchDismissed()).size).toBe(1);
  });
});

describe('chips', () => {
  it("keeps only the category's chips", async () => {
    const backend = createDemoBackend(memoryStorage());
    await backend.setChips(SFF_LIKED[0], 'sff', ['ideas', 'world-building', 'chemistry', 'ideas']);
    expect((await backend.fetchEntryForWork(SFF_LIKED[0]))!.chips).toEqual(['ideas', 'world-building']);
  });
});

describe('persistence', () => {
  it('survives a restart and resets to the seed', async () => {
    const storage = memoryStorage();
    const first = createDemoBackend(storage);
    await first.setShelf(newBook, 'want_to_read');
    expect(storage.data.has(DEMO_STORAGE_KEY)).toBe(true);

    const second = createDemoBackend(storage);
    expect(await second.fetchEntryForWork(newBook.openLibraryKey)).not.toBeNull();

    second.reset();
    expect(await createDemoBackend(storage).fetchEntryForWork(newBook.openLibraryKey)).toBeNull();
  });

  it('falls back to the seed when stored data is corrupt', async () => {
    const storage = memoryStorage();
    storage.setItem(DEMO_STORAGE_KEY, '{not json');
    const backend = createDemoBackend(storage);
    expect((await backend.fetchLibrary()).length).toBe(DEMO_BOOKS.length);
  });
});
