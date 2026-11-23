/**
 * On-device demo backend: lets you try the app with no account or database.
 *
 * State is a single JSON document in localStorage (expo-sqlite provides
 * localStorage on Android and iOS). It mirrors the rules of the database's
 * rank_book()/unrank_book() functions in supabase/migrations, so the app
 * behaves the same in demo mode and with real accounts.
 *
 * Book ids in demo mode are Open Library work keys.
 */

import type { BookSearchResult } from '@/lib/books/openLibrary';
import { getCategory, type CategorySlug } from '@/lib/catalog/categories';
import type { LibraryBackend, LibraryEntry, RankInput, RankedBook, ReadingStatus } from '@/lib/library/types';
import { scoreForPosition, type Bucket, type Comparison } from '@/lib/ranking';

import { DEMO_BOOKS, DEMO_RANKINGS, DEMO_SHELVES } from './seedData';

export const DEMO_STORAGE_KEY = 'readingapp.demo.v1';

export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

interface DemoEntry {
  status: ReadingStatus;
  category: CategorySlug | null;
  bucket: Bucket | null;
  position: number | null;
  chips: string[];
  updatedAt: string;
}

export interface DemoState {
  version: 1;
  books: Record<string, BookSearchResult>;
  entries: Record<string, DemoEntry>;
  comparisons: (Comparison & { category: CategorySlug; createdAt: string })[];
}

export type DemoBackend = LibraryBackend & {
  /** Restore the starting library. */
  reset(): void;
  /** For tests. */
  snapshot(): DemoState;
};

/** The starting library. Timestamps are staggered so the library has a natural order. */
export function createSeedState(now: Date = new Date()): DemoState {
  const books: DemoState['books'] = {};
  for (const b of DEMO_BOOKS) books[b.openLibraryKey] = b;

  const entries: DemoState['entries'] = {};
  let minutesAgo = 60 * 24 * 90;
  const stamp = () => new Date(now.getTime() - (minutesAgo -= 60 * 24 * 2) * 60_000).toISOString();

  for (const list of DEMO_RANKINGS) {
    list.books.forEach((key, position) => {
      entries[key] = { status: 'read', category: list.category, bucket: list.bucket, position, chips: [], updatedAt: stamp() };
    });
  }
  for (const shelf of DEMO_SHELVES) {
    for (const key of shelf.books) {
      entries[key] = { status: shelf.status, category: null, bucket: null, position: null, chips: [], updatedAt: stamp() };
    }
  }
  return { version: 1, books, entries, comparisons: [] };
}

function load(storage: KeyValueStorage | null): DemoState {
  const raw = storage?.getItem(DEMO_STORAGE_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as DemoState;
      if (parsed?.version === 1 && parsed.books && parsed.entries) return parsed;
    } catch {
      // Fall through to a fresh seed.
    }
  }
  return createSeedState();
}

export function createDemoBackend(
  storage: KeyValueStorage | null,
  now: () => Date = () => new Date(),
): DemoBackend {
  let state = load(storage);

  const save = () => storage?.setItem(DEMO_STORAGE_KEY, JSON.stringify(state));

  /** Book ids in a (category, bucket) list, best first. */
  const listOf = (category: CategorySlug, bucket: Bucket): string[] =>
    Object.entries(state.entries)
      .filter(([, e]) => e.category === category && e.bucket === bucket && e.position !== null)
      .sort(([, a], [, b]) => a.position! - b.position!)
      .map(([id]) => id);

  const renumber = (category: CategorySlug, bucket: Bucket) =>
    listOf(category, bucket).forEach((id, i) => {
      state.entries[id].position = i;
    });

  const removeFromList = (bookId: string) => {
    const e = state.entries[bookId];
    if (!e || e.position === null || !e.category || !e.bucket) return;
    const { category, bucket } = e;
    e.bucket = null;
    e.position = null;
    renumber(category, bucket);
  };

  const scoreOf = (bookId: string): number | null => {
    const e = state.entries[bookId];
    if (!e || e.position === null || !e.category || !e.bucket) return null;
    return scoreForPosition(e.bucket, e.position, listOf(e.category, e.bucket).length);
  };

  const toEntry = (bookId: string): LibraryEntry => {
    const e = state.entries[bookId];
    const b = state.books[bookId];
    return {
      bookId,
      status: e.status,
      category: e.category,
      bucket: e.bucket,
      rankPosition: e.position,
      score: scoreOf(bookId),
      chips: [...e.chips],
      updatedAt: e.updatedAt,
      book: { title: b.title, authors: b.authors, coverUrl: b.coverUrl, openLibraryKey: b.openLibraryKey },
    };
  };

  const ensure = (book: BookSearchResult): string => {
    if (!state.books[book.openLibraryKey]) state.books[book.openLibraryKey] = book;
    return book.openLibraryKey;
  };

  const touch = (bookId: string) => {
    state.entries[bookId].updatedAt = now().toISOString();
  };

  return {
    kind: 'demo',

    async fetchLibrary() {
      return Object.keys(state.entries)
        .map(toEntry)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    },

    async fetchEntryForWork(openLibraryKey) {
      return state.entries[openLibraryKey] ? toEntry(openLibraryKey) : null;
    },

    async fetchCatalogBookByWork(openLibraryKey) {
      return state.books[openLibraryKey] ?? null;
    },

    async ensureBook(book) {
      const id = ensure(book);
      save();
      return id;
    },

    async setShelf(book, status) {
      const id = ensure(book);
      const e = state.entries[id];
      if (!e) {
        state.entries[id] = { status, category: null, bucket: null, position: null, chips: [], updatedAt: '' };
      } else if (e.status === status) {
        return;
      } else {
        // Only read books can be ranked.
        if (status !== 'read') removeFromList(id);
        e.status = status;
      }
      touch(id);
      save();
    },

    async fetchRankedList(category, bucket): Promise<RankedBook[]> {
      return listOf(category, bucket).map((id) => {
        const b = state.books[id];
        return { bookId: id, title: b.title, authors: b.authors, coverUrl: b.coverUrl };
      });
    },

    async rankBook({ bookId, category, bucket, position, comparisons }: RankInput) {
      if (!state.books[bookId]) throw new Error(`Unknown book ${bookId}`);
      getCategory(category); // throws for unknown categories

      removeFromList(bookId);
      const list = listOf(category, bucket);
      if (!Number.isInteger(position) || position < 0 || position > list.length) {
        throw new RangeError(`position ${position} out of range 0..${list.length}`);
      }
      list.splice(position, 0, bookId);

      const existing = state.entries[bookId];
      state.entries[bookId] = {
        status: 'read',
        category,
        bucket,
        position,
        chips: existing?.chips ?? [],
        updatedAt: '',
      };
      list.forEach((id, i) => {
        state.entries[id].position = i;
      });
      touch(bookId);

      // Like rank_book(): keep only comparisons between this book and its new list.
      const others = new Set(list.filter((id) => id !== bookId));
      const createdAt = now().toISOString();
      for (const c of comparisons) {
        const other = c.winner === bookId ? c.loser : c.loser === bookId ? c.winner : null;
        if (other && others.has(other)) state.comparisons.push({ ...c, category, createdAt });
      }

      save();
      return scoreOf(bookId)!;
    },

    async unrankBook(bookId) {
      removeFromList(bookId);
      if (state.entries[bookId]) touch(bookId);
      save();
    },

    async setChips(bookId, category, chipSlugs) {
      const e = state.entries[bookId];
      if (!e) throw new Error(`Book ${bookId} is not in the library`);
      const allowed = new Set(getCategory(category).chips.map((c) => c.slug));
      e.chips = [...new Set(chipSlugs)].filter((slug) => allowed.has(slug));
      save();
    },

    reset() {
      state = createSeedState(now());
      save();
    },

    snapshot() {
      return JSON.parse(JSON.stringify(state)) as DemoState;
    },
  };
}
