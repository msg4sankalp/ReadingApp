/**
 * Predict how a reader would score a book, with a reason.
 *
 *   predicted = genre baseline + taste adjustment + small quality nudge
 *
 * - Genre baseline: the reader's typical score in the book's genre.
 * - Taste adjustment: how much the book's subjects and authors resemble the
 *   reader's top-ranked books in that genre (minus resemblance to the bottom ones).
 * - Quality nudge: the community rating, kept small so popularity doesn't
 *   drown out taste.
 */

import { getCategory, type CategorySlug } from '@/lib/catalog/categories';
import type { LibraryEntry } from '@/lib/library/types';

import { authorFeature, bookFeatures, isAuthorFeature } from './features';
import type { Taste } from './taste';

export interface PredictableBook {
  openLibraryKey?: string | null;
  title: string;
  authors: readonly string[];
  subjects: readonly string[];
  category: CategorySlug | null;
  rating?: { average: number; count: number } | null;
}

export interface Prediction {
  score: number;
  /** Low when the genre has few ranked books or nothing matched the reader's taste. */
  confident: boolean;
  reason: string;
  /** The reader's books that this prediction leans on (for "Because you loved…"). */
  because: LibraryEntry[];
}

const MAX_ADJUST = 2.2;
const QUALITY_PRIOR = 3.9;

/** Community rating (1–5) as a small ± nudge, Bayesian-averaged so few ratings count for little. */
export function qualityNudge(rating: { average: number; count: number } | null | undefined): number {
  if (!rating || rating.count <= 0) return 0;
  const bayes = (rating.average * rating.count + QUALITY_PRIOR * 15) / (rating.count + 15);
  return Math.max(-0.6, Math.min(0.6, (bayes - QUALITY_PRIOR) * 1.2));
}

const round1 = (n: number) => Math.round(n * 10) / 10;

export function predict(book: PredictableBook, taste: Taste): Prediction {
  const genre = book.category ? taste.genres.get(book.category) : undefined;
  const features = bookFeatures(book);

  // A genre you haven't ranked: start a bit below your overall average.
  const baseline = genre?.baseline ?? taste.overallMean - 0.6;
  // Average the weights of the features we know about (rather than summing, so a
  // book with 30 subjects can't pile up a huge adjustment), scaled up gently
  // as more features match.
  let total = 0;
  let known = 0;
  const matched: string[] = [];
  for (const f of features) {
    const local = genre?.weights.get(f);
    const w = local ?? (taste.globalWeights.get(f) ?? 0) * 0.5;
    if (w !== 0) {
      total += w;
      known++;
      if (w > 0) matched.push(f);
    }
  }
  const adjust = known
    ? Math.max(-MAX_ADJUST, Math.min(MAX_ADJUST, (total / known) * Math.min(3, 1 + Math.log2(known)) * 1.6))
    : 0;
  const score = Math.max(0.5, Math.min(9.9, baseline + adjust + qualityNudge(book.rating)));

  // Which of the reader's liked books does this most resemble?
  const featureSet = new Set(features);
  const pool = (genre?.books ?? []).filter((e) => e.bucket === 'liked' && e.book.openLibraryKey !== book.openLibraryKey);
  const because = pool
    .map((e) => ({ e, overlap: bookFeatures(e.book).filter((f) => featureSet.has(f)).length }))
    .filter((x) => x.overlap > 0)
    .sort((a, b) => b.overlap - a.overlap || b.e.score! - a.e.score!)
    .slice(0, 2)
    .map((x) => x.e);

  const sameAuthor = pool.find((e) => e.book.authors.some((a) => featureSet.has(authorFeature(a))));
  const reason = sameAuthor
    ? `You loved ${sameAuthor.book.title}, by the same author`
    : because.length === 2
      ? `Because you loved ${because[0].book.title} and ${because[1].book.title}`
      : because.length === 1
        ? `Because you loved ${because[0].book.title}`
        : genre && genre.satisfaction >= 0.6
          ? `Highly rated in ${getCategory(genre.category).shortName.toLowerCase()}, a genre you love`
          : book.category && !genre
            ? `Something different: ${getCategory(book.category).shortName.toLowerCase()}`
            : 'Highly rated by readers';

  const matchedSubjects = matched.filter((f) => !isAuthorFeature(f));
  return {
    score: round1(score),
    confident: Boolean(genre && genre.ranked >= 5 && (matchedSubjects.length > 0 || sameAuthor)),
    reason,
    because: sameAuthor ? [sameAuthor] : because,
  };
}

