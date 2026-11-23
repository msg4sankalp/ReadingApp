/**
 * Score calculation.
 *
 * Users never enter a score. A book's 1–10 score is derived from:
 *   1. its bucket (liked / fine / disliked), an absolute judgement that is
 *      comparable across genres, and
 *   2. its position within its (category, bucket) list, a relative judgement
 *      that is only meaningful inside one genre.
 *
 * See PLAN.md → "The ranking system".
 */

export type Bucket = 'liked' | 'fine' | 'disliked';

export const BUCKETS: readonly Bucket[] = ['liked', 'fine', 'disliked'];

export interface ScoreBand {
  low: number;
  high: number;
}

export const BUCKET_BANDS: Record<Bucket, ScoreBand> = {
  liked: { low: 6.7, high: 10.0 },
  fine: { low: 3.4, high: 6.6 },
  disliked: { low: 0.0, high: 3.3 },
};

/**
 * Below this many ranked books in a category, scores in that category are
 * shown as provisional (for example "~8.5").
 */
export const PROVISIONAL_THRESHOLD = 5;

/**
 * Score for the book at `position` (0 = best) in a list of `listLength` books.
 * The best book gets the top of the band and the worst gets the bottom. A
 * single book gets the top of the band.
 */
export function scoreForPosition(bucket: Bucket, position: number, listLength: number): number {
  if (!Number.isInteger(listLength) || listLength < 1) {
    throw new RangeError(`listLength must be a positive integer, got ${listLength}`);
  }
  if (!Number.isInteger(position) || position < 0 || position >= listLength) {
    throw new RangeError(`position ${position} is out of range for a list of ${listLength}`);
  }
  // Exact integer arithmetic in tenths, so .x5 values round the same way as
  // Postgres's round() in bucket_score(). Floating point would turn 9.45 into
  // 9.4499… and round it down.
  const { low, high } = BUCKET_BANDS[bucket];
  const high10 = Math.round(high * 10);
  const width10 = high10 - Math.round(low * 10);
  if (listLength === 1) return high10 / 10;
  const den = listLength - 1;
  const num = high10 * den - position * width10; // score × 10 = num / den
  return Math.floor((2 * num + den) / (2 * den)) / 10; // round half up
}

/** Scores for an ordered (best-first) list, in the same order. */
export function scoresForList(bucket: Bucket, listLength: number): number[] {
  return Array.from({ length: listLength }, (_, i) => scoreForPosition(bucket, i, listLength));
}

/**
 * Whether scores in a category are still provisional. `rankedInCategory`
 * counts ranked books across all buckets in the category.
 */
export function isProvisional(rankedInCategory: number): boolean {
  return rankedInCategory < PROVISIONAL_THRESHOLD;
}

/** Display a score, e.g. "8.7", or "~8.7" when provisional. */
export function formatScore(score: number, provisional = false): string {
  return `${provisional ? '~' : ''}${score.toFixed(1)}`;
}
