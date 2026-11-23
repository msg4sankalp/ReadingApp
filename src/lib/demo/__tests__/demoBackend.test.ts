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
    expect(hailMary.score).toBe(10);
    const hobbit = library.find((e) => e.bookId === SFF_LIKED[SFF_LIKED.length - 1])!;
    expect(hobbit.score).toBe(6.7);
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
    expect(score).toBe(9.3); // position 1 of 6: 10 - (1/5) * 3.3
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
