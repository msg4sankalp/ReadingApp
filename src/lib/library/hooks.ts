import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { openLibrary, type BookSearchResult } from '@/lib/books/openLibrary';
import type { CategorySlug } from '@/lib/catalog/categories';
import type { Bucket } from '@/lib/ranking';

import { useBackend } from './backend';
import type { RankInput, ReadingStatus } from './types';

export const queryKeys = {
  /** Everything about the user's library; invalidate this after any write. */
  library: ['library'] as const,
  entries: () => ['library', 'entries'] as const,
  entry: (workKey: string) => ['library', 'entry', workKey] as const,
  rankedList: (category: CategorySlug, bucket: Bucket) => ['library', 'ranked', category, bucket] as const,
  search: (query: string) => ['search', query] as const,
  book: (workKey: string) => ['book', workKey] as const,
  work: (workKey: string) => ['work', workKey] as const,
};

/** "OL893415W" ↔ "/works/OL893415W". Routes use the short form. */
export const workIdFromKey = (key: string) => key.replace('/works/', '');
export const workKeyFromId = (id: string) => `/works/${id}`;

export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}

export function useBookSearch(query: string) {
  const q = query.trim();
  return useQuery({
    queryKey: queryKeys.search(q.toLowerCase()),
    queryFn: ({ signal }) => openLibrary.search(q, { signal }),
    enabled: q.length >= 2,
    staleTime: 10 * 60_000,
  });
}

/**
 * A book for the book page: from the search result that was tapped (seeded
 * into the cache by the search screen), else from our catalog.
 */
export function useBook(workKey: string) {
  const backend = useBackend();
  return useQuery({
    queryKey: queryKeys.book(workKey),
    queryFn: () => backend.fetchCatalogBookByWork(workKey),
    staleTime: Infinity,
  });
}

export function useSeedBook() {
  const client = useQueryClient();
  return (book: BookSearchResult) => client.setQueryData(queryKeys.book(book.openLibraryKey), book);
}

export function useWorkDetails(workKey: string) {
  return useQuery({
    queryKey: queryKeys.work(workKey),
    queryFn: ({ signal }) => openLibrary.getWork(workKey, { signal }),
    staleTime: 60 * 60_000,
  });
}

export function useLibrary() {
  const backend = useBackend();
  return useQuery({ queryKey: queryKeys.entries(), queryFn: () => backend.fetchLibrary() });
}

export function useLibraryEntry(workKey: string) {
  const backend = useBackend();
  return useQuery({ queryKey: queryKeys.entry(workKey), queryFn: () => backend.fetchEntryForWork(workKey) });
}

export function useSetShelf() {
  const backend = useBackend();
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ book, status }: { book: BookSearchResult; status: ReadingStatus }) =>
      backend.setShelf(book, status),
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.library }),
  });
}

export function useRankBook() {
  const backend = useBackend();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: RankInput) => backend.rankBook(input),
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.library }),
  });
}

export function useSetChips() {
  const backend = useBackend();
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ bookId, category, chips }: { bookId: string; category: CategorySlug; chips: string[] }) =>
      backend.setChips(bookId, category, chips),
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.library }),
  });
}
