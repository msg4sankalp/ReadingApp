/**
 * R2 · Find candidate books for a reader, then score and pick a varied list.
 */

import type { BookSearchResult } from '@/lib/books/openLibrary';
import type { CategorySlug } from '@/lib/catalog/categories';

import { predict, type Prediction } from './predict';
import { favoriteGenres, topFeatures, type Taste } from './taste';

export interface CandidateQuery {
  subject?: string;
  author?: string;
  /** The genre this query is for; used when a book's own genre can't be guessed. */
  genre: CategorySlug;
  limit: number;
}

/** A broad subject per genre, for "best-rated in your favorite genre". */
const STAPLE_SUBJECT: Record<CategorySlug, string> = {
  'literary-fiction': 'literary fiction',
  sff: 'science fiction',
  'mystery-thriller': 'mystery',
  romance: 'romance',
  horror: 'horror',
  'historical-fiction': 'historical fiction',
  'memoir-biography': 'biography',
  history: 'history',
  'science-nature': 'popular science',
  'society-ideas': 'political science',
  'business-self-improvement': 'self-help',
  poetry: 'poetry',
  'graphic-novels': 'graphic novels',
};

/** Open Library searches to run for this reader (about a dozen). */
export function candidateQueries(taste: Taste): CandidateQuery[] {
  const queries: CandidateQuery[] = [];
  const genres = favoriteGenres(taste).slice(0, 3);
  for (const g of genres) {
    queries.push({ subject: STAPLE_SUBJECT[g.category], genre: g.category, limit: 25 });
    for (const subject of topFeatures(g, 2)) {
      if (subject !== STAPLE_SUBJECT[g.category]) queries.push({ subject, genre: g.category, limit: 20 });
    }
  }
  // Authors behind the reader's favorite books.
  const lovedAuthors = new Map<string, CategorySlug>();
  for (const g of favoriteGenres(taste)) {
    for (const b of g.books) {
      if (b.bucket !== 'liked' || (b.score ?? 0) < 8.5) continue;
      const a = b.book.authors[0];
      if (a && !lovedAuthors.has(a)) lovedAuthors.set(a, g.category);
    }
  }
  for (const [author, genre] of [...lovedAuthors].slice(0, 4)) queries.push({ author, genre, limit: 8 });
  return queries;
}

const DERIVATIVE = /\b(summary|summaries|study guide|workbook|sparknotes|cliffsnotes|trivia|analysis of|conversations on|coloring book|journal)\b/i;
const BOX_SET = / \/ |\bbox(ed)? set\b|\bomnibus\b|\bcollection\b|\btrilogy\b|\bbooks? \d+\s*[-–&]\s*\d+/i;
/** "Book 3", "Vol. 2", "#4", "Part 2": a later volume of a series. */
const LATER_VOLUME = /\b(?:book|vol\.?|volume|part|#)\s*(\d+)\b/i;

export function isLaterVolume(title: string): boolean {
  const m = LATER_VOLUME.exec(title);
  return Boolean(m && Number(m[1]) > 1);
}

export function filterCandidates(
  books: readonly (BookSearchResult & { queryGenre?: CategorySlug })[],
  { libraryKeys, dismissed }: { libraryKeys: Set<string>; dismissed: Set<string> },
): (BookSearchResult & { queryGenre?: CategorySlug })[] {
  const seen = new Set<string>();
  const out: (BookSearchResult & { queryGenre?: CategorySlug })[] = [];
  for (const b of books) {
    const titleKey = `${b.title.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()}|${(b.authors[0] ?? '').toLowerCase()}`;
    if (seen.has(b.openLibraryKey) || seen.has(titleKey)) continue;
    seen.add(b.openLibraryKey);
    seen.add(titleKey);
    if (libraryKeys.has(b.openLibraryKey) || dismissed.has(b.openLibraryKey)) continue;
    if (DERIVATIVE.test(b.title) || BOX_SET.test(b.title) || isLaterVolume(b.title)) continue;
    // Too obscure to trust: few ratings and few editions.
    if ((b.rating?.count ?? 0) < 5 && (b.editionCount ?? 0) < 5) continue;
    out.push(b);
  }
  return out;
}

export interface Recommendation {
  book: BookSearchResult;
  category: CategorySlug;
  prediction: Prediction;
}

/** Score every candidate and pick a varied list: at most 2 per author, no genre taking over. */
export function pickRecommendations(
  candidates: readonly (BookSearchResult & { queryGenre?: CategorySlug })[],
  taste: Taste,
  { count = 20 }: { count?: number } = {},
): Recommendation[] {
  const scored: Recommendation[] = [];
  for (const b of candidates) {
    const category = b.suggestedCategory ?? b.queryGenre;
    if (!category) continue;
    scored.push({ book: b, category, prediction: predict({ ...b, category }, taste) });
  }
  scored.sort((a, b) => b.prediction.score - a.prediction.score || (b.book.rating?.count ?? 0) - (a.book.rating?.count ?? 0));

  const perAuthor = new Map<string, number>();
  const perGenre = new Map<CategorySlug, number>();
  const genreCap = Math.max(2, Math.ceil(count / 2));
  const picks: Recommendation[] = [];
  for (const r of scored) {
    if (picks.length >= count) break;
    const author = (r.book.authors[0] ?? '').toLowerCase();
    if ((perAuthor.get(author) ?? 0) >= 2 || (perGenre.get(r.category) ?? 0) >= genreCap) continue;
    perAuthor.set(author, (perAuthor.get(author) ?? 0) + 1);
    perGenre.set(r.category, (perGenre.get(r.category) ?? 0) + 1);
    picks.push(r);
  }
  return picks;
}

