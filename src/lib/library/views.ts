/**
 * Pure helpers that turn library entries into what the Library screen shows.
 */

import { CATEGORIES, type Category, type CategorySlug } from '@/lib/catalog/categories';
import { BUCKETS, isProvisional, type Bucket } from '@/lib/ranking';

import type { LibraryEntry, ReadingStatus } from './types';

export type GenreFilter = CategorySlug | 'all';

export type RankedItem =
  | { kind: 'divider'; bucket: Bucket }
  | { kind: 'book'; entry: LibraryEntry; rank: number; provisional: boolean };

const BUCKET_ORDER = new Map(BUCKETS.map((b, i) => [b, i]));
const CATEGORY_ORDER = new Map(CATEGORIES.map((c, i) => [c.slug, i]));

const isRanked = (e: LibraryEntry) => e.score !== null && e.category !== null && e.bucket !== null;

export function shelfCounts(entries: readonly LibraryEntry[]): Record<ReadingStatus, number> {
  const counts: Record<ReadingStatus, number> = { reading: 0, want_to_read: 0, read: 0 };
  for (const e of entries) counts[e.status]++;
  return counts;
}

/** Books on a shelf, most recently changed first. */
export function shelfEntries(entries: readonly LibraryEntry[], status: ReadingStatus): LibraryEntry[] {
  return entries.filter((e) => e.status === status).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

/** Read books that haven't been ranked yet. */
export function unrankedEntries(entries: readonly LibraryEntry[]): LibraryEntry[] {
  return shelfEntries(entries, 'read').filter((e) => !isRanked(e));
}

/** Genres with at least one ranked book, most-ranked first (ties in category order). */
export function rankedGenres(entries: readonly LibraryEntry[]): { category: Category; count: number }[] {
  const counts = new Map<CategorySlug, number>();
  for (const e of entries) if (isRanked(e)) counts.set(e.category!, (counts.get(e.category!) ?? 0) + 1);
  return CATEGORIES.filter((c) => counts.has(c.slug))
    .map((category) => ({ category, count: counts.get(category.slug)! }))
    .sort((a, b) => b.count - a.count || CATEGORY_ORDER.get(a.category.slug)! - CATEGORY_ORDER.get(b.category.slug)!);
}

/**
 * The ranked list for a genre, or for all genres.
 * - A genre: Liked, then Fine, then Didn't like, each in rank order, with a
 *   divider before each group. Rank numbers run continuously across groups.
 * - All: every ranked book by score, highest first, with no dividers. On equal
 *   scores, established scores come before provisional ones.
 */
export function rankedItems(entries: readonly LibraryEntry[], filter: GenreFilter): RankedItem[] {
  const ranked = entries.filter(isRanked);
  const perGenre = new Map<CategorySlug, number>();
  for (const e of ranked) perGenre.set(e.category!, (perGenre.get(e.category!) ?? 0) + 1);
  const provisional = (e: LibraryEntry) => isProvisional(perGenre.get(e.category!) ?? 0);

  if (filter === 'all') {
    return [...ranked]
      .sort(
        (a, b) =>
          b.score! - a.score! ||
          Number(provisional(a)) - Number(provisional(b)) ||
          CATEGORY_ORDER.get(a.category!)! - CATEGORY_ORDER.get(b.category!)! ||
          a.book.title.localeCompare(b.book.title),
      )
      .map((entry, i) => ({ kind: 'book', entry, rank: i + 1, provisional: provisional(entry) }));
  }

  const list = ranked
    .filter((e) => e.category === filter)
    .sort(
      (a, b) => BUCKET_ORDER.get(a.bucket!)! - BUCKET_ORDER.get(b.bucket!)! || a.rankPosition! - b.rankPosition!,
    );
  const items: RankedItem[] = [];
  let lastBucket: Bucket | null = null;
  list.forEach((entry, i) => {
    if (entry.bucket !== lastBucket) {
      items.push({ kind: 'divider', bucket: entry.bucket! });
      lastBucket = entry.bucket;
    }
    items.push({ kind: 'book', entry, rank: i + 1, provisional: provisional(entry) });
  });
  return items;
}

export const BUCKET_LABELS: Record<Bucket, string> = { liked: 'Liked', fine: 'Fine', disliked: "Didn't like" };
