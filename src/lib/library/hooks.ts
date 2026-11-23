import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { openLibrary, type BookSearchResult } from '@/lib/books/openLibrary';
import { useUserId } from '@/lib/auth/session';

import {
  fetchCatalogBookByWork,
  fetchEntryForWork,
  fetchLibrary,
  setShelf,
  type ReadingStatus,
} from './api';

export const queryKeys = {
  library: (userId: string) => ['library', userId] as const,
  entry: (userId: string, workKey: string) => ['library', userId, 'entry', workKey] as const,
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
  return useQuery({
    queryKey: queryKeys.book(workKey),
    queryFn: () => fetchCatalogBookByWork(workKey),
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
  const userId = useUserId();
  return useQuery({ queryKey: queryKeys.library(userId), queryFn: () => fetchLibrary(userId) });
}

export function useLibraryEntry(workKey: string) {
  const userId = useUserId();
  return useQuery({
    queryKey: queryKeys.entry(userId, workKey),
    queryFn: () => fetchEntryForWork(userId, workKey),
  });
}

export function useSetShelf() {
  const userId = useUserId();
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ book, status }: { book: BookSearchResult; status: ReadingStatus }) =>
      setShelf(userId, book, status),
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.library(userId) }),
  });
}
