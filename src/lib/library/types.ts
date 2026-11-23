import type { BookSearchResult } from '@/lib/books/openLibrary';
import type { CategorySlug } from '@/lib/catalog/categories';
import type { Bucket, Comparison } from '@/lib/ranking';

export type ReadingStatus = 'want_to_read' | 'reading' | 'read';

export const SHELVES: { status: ReadingStatus; label: string }[] = [
  { status: 'reading', label: 'Reading' },
  { status: 'want_to_read', label: 'Want to Read' },
  { status: 'read', label: 'Read' },
];

export interface EntryBook {
  title: string;
  authors: string[];
  coverUrl: string | null;
  openLibraryKey: string | null;
}

/** One book in the user's library. Ranking fields are null until ranked. */
export interface LibraryEntry {
  bookId: string;
  status: ReadingStatus;
  category: CategorySlug | null;
  bucket: Bucket | null;
  /** Position within the (category, bucket) list, 0 = best. */
  rankPosition: number | null;
  score: number | null;
  /** "What made it work?" chip slugs. */
  chips: string[];
  /** Local calendar days, "YYYY-MM-DD". See readingDates.ts. */
  startedAt: string | null;
  finishedAt: string | null;
  updatedAt: string;
  book: EntryBook;
}

export interface RankedBook {
  bookId: string;
  title: string;
  authors: string[];
  coverUrl: string | null;
}

export interface RankInput {
  bookId: string;
  category: CategorySlug;
  bucket: Bucket;
  position: number;
  comparisons: Comparison[];
}

/**
 * Where library data lives. Implemented by Supabase (real accounts) and by an
 * on-device demo store. Both follow the same rules: see rank_book() in
 * supabase/migrations for the reference behaviour.
 */
export interface LibraryBackend {
  readonly kind: 'supabase' | 'demo';
  fetchLibrary(): Promise<LibraryEntry[]>;
  fetchEntryForWork(openLibraryKey: string): Promise<LibraryEntry | null>;
  fetchCatalogBookByWork(openLibraryKey: string): Promise<BookSearchResult | null>;
  /** Add a book to the catalog if needed; returns its book id. */
  ensureBook(book: BookSearchResult): Promise<string>;
  setShelf(book: BookSearchResult, status: ReadingStatus): Promise<void>;
  /** A (category, bucket) list, best first. */
  fetchRankedList(category: CategorySlug, bucket: Bucket): Promise<RankedBook[]>;
  /** Insert or move a book into a ranked list. Returns the book's new score. */
  rankBook(input: RankInput): Promise<number>;
  unrankBook(bookId: string): Promise<void>;
  setChips(bookId: string, category: CategorySlug, chipSlugs: string[]): Promise<void>;
  /** Replace a book's start and finish dates ("YYYY-MM-DD" or null). */
  setDates(bookId: string, dates: { startedAt: string | null; finishedAt: string | null }): Promise<void>;
}
