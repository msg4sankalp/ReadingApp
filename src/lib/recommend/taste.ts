/**
 * R1 · Taste profile, built from the reader's library. Two levels, like ranking:
 *
 * - Across genres: how much you read each genre (engagement) and how you felt
 *   about those books (satisfaction, from liked / fine / didn't like).
 * - Within a genre: which subjects and authors run through your top-ranked
 *   books versus your bottom-ranked ones (feature weights).
 *
 * Small numbers are shrunk toward broader averages, so one loved book doesn't
 * define a whole genre.
 */

import { CATEGORIES, type CategorySlug } from '@/lib/catalog/categories';
import type { LibraryEntry } from '@/lib/library/types';

import { bookFeatures } from './features';

/** Pseudo-counts for shrinkage toward broader averages. */
const GENRE_PRIOR = 3;
const FEATURE_PRIOR = 1;

export interface GenreTaste {
  category: CategorySlug;
  /** Ranked books in this genre. */
  ranked: number;
  /** Share of ranked books you liked (0–1), shrunk toward your overall share. */
  satisfaction: number;
  /** Your expected score for a typical book in this genre. */
  baseline: number;
  /** 0–1: how much this genre matters to you (engagement × satisfaction). */
  affinity: number;
  /** Feature → weight. Positive: runs through your favorites; negative: your least favorites. */
  weights: Map<string, number>;
  /** Ranked books, best first. */
  books: LibraryEntry[];
}

export interface Taste {
  genres: Map<CategorySlug, GenreTaste>;
  /** Weights across all genres (used when a genre has little data). */
  globalWeights: Map<string, number>;
  overallMean: number;
  overallSatisfaction: number;
  totalRanked: number;
  /** Open Library keys of every book in the library (never recommend these). */
  libraryKeys: Set<string>;
}

const isRanked = (e: LibraryEntry) => e.score !== null && e.category !== null && e.bucket !== null;

/**
 * How strongly a ranked book says "more like this" (+) or "less like this" (−),
 * relative to the other books in the same set. Measuring against the set's own
 * average matters: subjects that every book in a genre shares then net out to
 * about zero, and only distinctive subjects carry weight. (The genre baseline
 * already covers how much you like the genre as a whole.)
 */
export function bookSignal(score: number, average: number): number {
  return Math.max(-1.5, Math.min(1.5, (score - average) / 2.5));
}

function featureWeights(books: readonly LibraryEntry[]): Map<string, number> {
  const average = books.length ? books.reduce((s, e) => s + e.score!, 0) / books.length : 0;
  const sums = new Map<string, { sum: number; n: number }>();
  for (const b of books) {
    const signal = bookSignal(b.score!, average);
    for (const f of bookFeatures(b.book)) {
      const s = sums.get(f) ?? { sum: 0, n: 0 };
      s.sum += signal;
      s.n += 1;
      sums.set(f, s);
    }
  }
  const weights = new Map<string, number>();
  for (const [f, { sum, n }] of sums) weights.set(f, sum / (n + FEATURE_PRIOR));
  return weights;
}

export function buildTaste(entries: readonly LibraryEntry[]): Taste {
  const ranked = entries.filter(isRanked);
  const overallMean = ranked.length ? ranked.reduce((s, e) => s + e.score!, 0) / ranked.length : 6.5;
  const overallSatisfaction = ranked.length ? ranked.filter((e) => e.bucket === 'liked').length / ranked.length : 0.5;
  const maxPerGenre = Math.max(1, ...CATEGORIES.map((c) => ranked.filter((e) => e.category === c.slug).length));

  const genres = new Map<CategorySlug, GenreTaste>();
  for (const c of CATEGORIES) {
    const books = ranked
      .filter((e) => e.category === c.slug)
      .sort((a, b) => b.score! - a.score!);
    if (books.length === 0) continue;
    const n = books.length;
    const liked = books.filter((e) => e.bucket === 'liked').length;
    const satisfaction = (liked + overallSatisfaction * GENRE_PRIOR) / (n + GENRE_PRIOR);
    const baseline = (books.reduce((s, e) => s + e.score!, 0) + overallMean * GENRE_PRIOR) / (n + GENRE_PRIOR);
    const engagement = Math.sqrt(n / maxPerGenre);
    genres.set(c.slug, {
      category: c.slug,
      ranked: n,
      satisfaction,
      baseline,
      affinity: engagement * (0.4 + 0.6 * satisfaction),
      weights: featureWeights(books),
      books,
    });
  }

  return {
    genres,
    globalWeights: featureWeights(ranked),
    overallMean,
    overallSatisfaction,
    totalRanked: ranked.length,
    libraryKeys: new Set(entries.flatMap((e) => (e.book.openLibraryKey ? [e.book.openLibraryKey] : []))),
  };
}

/** Genres by affinity, strongest first. */
export function favoriteGenres(taste: Taste): GenreTaste[] {
  return [...taste.genres.values()].sort((a, b) => b.affinity - a.affinity);
}

/** The genre's most positive subject features, e.g. ["hard science fiction", "space flight"]. */
export function topFeatures(genre: GenreTaste, count: number, { subjectsOnly = true } = {}): string[] {
  return [...genre.weights.entries()]
    .filter(([f, w]) => w > 0.15 && (!subjectsOnly || !f.startsWith('author:')))
    .sort((a, b) => b[1] - a[1])
    .slice(0, count)
    .map(([f]) => f);
}
