import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';

import { openLibrary, type BookSearchResult } from '@/lib/books/openLibrary';
import { useBackend } from '@/lib/library/backend';
import { queryKeys, useLibrary } from '@/lib/library/hooks';
import type { RecommendationAction } from '@/lib/library/types';

import { candidateQueries, filterCandidates, pickRecommendations, type Recommendation } from './candidates';
import { predict, type PredictableBook } from './predict';
import { buildTaste } from './taste';

/** Like Promise.allSettled, but runs at most `limit` tasks at once. */
export async function settleWithLimit<T, R>(
  items: readonly T[],
  limit: number,
  run: (item: T) => Promise<R>,
): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      try {
        results[i] = { status: 'fulfilled', value: await run(items[i]) };
      } catch (reason) {
        results[i] = { status: 'rejected', reason };
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

/** The reader's taste profile, rebuilt whenever the library changes. */
export function useTaste() {
  const library = useLibrary();
  return useMemo(() => (library.data ? buildTaste(library.data) : null), [library.data]);
}

/** Predicted score for one book, or null if the reader hasn't ranked anything yet. */
export function usePrediction(book: PredictableBook | null) {
  const taste = useTaste();
  return useMemo(() => (book && taste && taste.totalRanked > 0 ? predict(book, taste) : null), [book, taste]);
}

export function useRecommendations({ count = 20 }: { count?: number } = {}) {
  const backend = useBackend();
  const taste = useTaste();
  const queries = useMemo(() => (taste && taste.totalRanked > 0 ? candidateQueries(taste) : []), [taste]);
  const queryKey = queries.map((q) => `${q.genre}:${q.subject ?? `author=${q.author}`}`).join('|');

  const dismissed = useQuery({ queryKey: [...queryKeys.library, 'dismissed'], queryFn: () => backend.fetchDismissed() });

  const candidates = useQuery({
    queryKey: ['recommend', 'candidates', queryKey],
    enabled: queries.length > 0,
    staleTime: 6 * 60 * 60_000,
    queryFn: async ({ signal }) => {
      // At most 3 searches at a time: Open Library asks apps to be gentle, and
      // a burst of a dozen requests gets some of them refused.
      const results = await settleWithLimit(queries, 3, (q) =>
        openLibrary
          .discover({ subject: q.subject, author: q.author }, { limit: q.limit, signal })
          .then((books) => books.map((b) => ({ ...b, queryGenre: q.genre }))),
      );
      const ok = results.flatMap((r) => (r.status === 'fulfilled' ? r.value : []));
      if (ok.length === 0 && results.some((r) => r.status === 'rejected')) {
        throw (results.find((r) => r.status === 'rejected') as PromiseRejectedResult).reason;
      }
      return ok;
    },
  });

  const recommendations = useMemo<Recommendation[]>(() => {
    if (!taste || !candidates.data || !dismissed.data) return [];
    const pool = filterCandidates(candidates.data, { libraryKeys: taste.libraryKeys, dismissed: dismissed.data });
    return pickRecommendations(pool, taste, { count });
  }, [taste, candidates.data, dismissed.data, count]);

  return {
    taste,
    recommendations,
    /** Nothing ranked yet, so there's nothing to base picks on. */
    needsRankings: Boolean(taste && taste.totalRanked === 0),
    isLoading: (queries.length > 0 && candidates.isPending) || dismissed.isPending,
    error: candidates.error ?? dismissed.error,
    refetch: () => candidates.refetch(),
  };
}

/** Want to Read / Already read / Not interested, on a recommendation. */
export function useRecommendationAction() {
  const backend = useBackend();
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({
      book,
      action,
      predictedScore,
    }: {
      book: BookSearchResult;
      action: RecommendationAction;
      predictedScore: number | null;
    }) => {
      if (action === 'want_to_read') await backend.setShelf(book, 'want_to_read');
      if (action === 'already_read') await backend.setShelf(book, 'read');
      await backend.recordFeedback(book, action, predictedScore);
    },
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.library }),
  });
}
