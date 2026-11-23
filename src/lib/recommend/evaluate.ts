/**
 * R3 · Offline accuracy test. Hide each ranked book in turn, rebuild the
 * reader's taste from the rest, predict the hidden book's score, and compare
 * with the real one. Reports the average error of the full model next to two
 * simpler guesses, so we can see whether taste matching actually helps.
 */

import type { LibraryEntry } from '@/lib/library/types';

import { predict } from './predict';
import { buildTaste } from './taste';

export interface Evaluation {
  books: number;
  /** Average |predicted − actual| for the full model. */
  modelError: number;
  /** Same, guessing the reader's genre average (no subject or author matching). */
  genreAverageError: number;
  /** Same, guessing the reader's overall average. */
  overallAverageError: number;
  /**
   * Within each genre, the share of book pairs whose taste adjustments
   * (prediction minus genre baseline) are in the right order. Uses the
   * adjustment alone because in a leave-one-out test the baseline itself is
   * biased: hiding a top book lowers its genre's baseline, which would push
   * every model the wrong way. For real recommendations the baseline is fixed.
   */
  pairOrderAccuracy: number;
  /** Share of those pairs where the model had an opinion (non-tied adjustments). Ties count as half right. */
  pairCoverage: number;
  details: { title: string; actual: number; predicted: number }[];
}

export function evaluateLeaveOneOut(entries: readonly LibraryEntry[]): Evaluation {
  const ranked = entries.filter((e) => e.score !== null && e.category !== null);
  const details: Evaluation['details'] = [];
  let model = 0;
  let genreAvg = 0;
  let overall = 0;
  const adjustments = new Map<LibraryEntry, number>();

  for (const hidden of ranked) {
    const rest = entries.filter((e) => e !== hidden);
    const taste = buildTaste(rest);
    const p = predict({ ...hidden.book, category: hidden.category }, taste);
    const genre = taste.genres.get(hidden.category!);
    adjustments.set(hidden, p.score - (genre?.baseline ?? taste.overallMean));
    model += Math.abs(p.score - hidden.score!);
    genreAvg += Math.abs((genre?.baseline ?? taste.overallMean) - hidden.score!);
    overall += Math.abs(taste.overallMean - hidden.score!);
    details.push({ title: hidden.book.title, actual: hidden.score!, predicted: p.score });
  }

  let pairs = 0;
  let correct = 0;
  let opinions = 0;
  for (let i = 0; i < ranked.length; i++) {
    for (let j = i + 1; j < ranked.length; j++) {
      const a = ranked[i];
      const b = ranked[j];
      if (a.category !== b.category || a.score === b.score) continue;
      pairs++;
      const actual = Math.sign(a.score! - b.score!);
      const diff = adjustments.get(a)! - adjustments.get(b)!;
      const predicted = Math.abs(diff) < 0.05 ? 0 : Math.sign(diff);
      if (predicted === 0) correct += 0.5;
      else {
        opinions++;
        if (actual === predicted) correct++;
      }
    }
  }

  const n = Math.max(1, ranked.length);
  return {
    books: ranked.length,
    modelError: model / n,
    genreAverageError: genreAvg / n,
    overallAverageError: overall / n,
    pairOrderAccuracy: pairs ? correct / pairs : 0,
    pairCoverage: pairs ? opinions / pairs : 0,
    details,
  };
}
