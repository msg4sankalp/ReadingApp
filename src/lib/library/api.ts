/**
 * Library data access: the user's shelves and the shared book catalog.
 *
 * All writes go through Supabase with Row Level Security. Ranking fields are
 * written only by the rank_book()/unrank_book() database functions.
 */

import type { BookSearchResult } from '@/lib/books/openLibrary';
import { isCategorySlug } from '@/lib/catalog/categories';
import type { Bucket } from '@/lib/ranking';
import { supabase } from '@/lib/supabase/client';

export type ReadingStatus = 'want_to_read' | 'reading' | 'read';

export const SHELVES: { status: ReadingStatus; label: string }[] = [
  { status: 'reading', label: 'Reading' },
  { status: 'want_to_read', label: 'Want to Read' },
  { status: 'read', label: 'Read' },
];

export interface CatalogBook {
  id: string;
  title: string;
  authors: string[];
  cover_url: string | null;
  open_library_key: string | null;
}

export interface LibraryEntry {
  status: ReadingStatus;
  bucket: Bucket | null;
  score: number | null;
  updated_at: string;
  book: CatalogBook;
}

const LIBRARY_SELECT =
  'status, bucket, score, updated_at, book:books!inner(id, title, authors, cover_url, open_library_key)';

export async function fetchLibrary(userId: string): Promise<LibraryEntry[]> {
  const { data, error } = await supabase
    .from('user_books')
    .select(LIBRARY_SELECT)
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as LibraryEntry[];
}

/** The user's entry for an Open Library work, or null if it isn't in their library. */
export async function fetchEntryForWork(userId: string, openLibraryKey: string): Promise<LibraryEntry | null> {
  const { data, error } = await supabase
    .from('user_books')
    .select(LIBRARY_SELECT)
    .eq('user_id', userId)
    .eq('book.open_library_key', openLibraryKey)
    .maybeSingle();
  if (error) throw error;
  return (data as unknown as LibraryEntry | null) ?? null;
}

/** A book from our catalog, in the same shape as an Open Library search result. */
export async function fetchCatalogBookByWork(openLibraryKey: string): Promise<BookSearchResult | null> {
  const { data, error } = await supabase
    .from('books')
    .select(
      'open_library_key, title, subtitle, authors, cover_url, first_publish_year, page_count, isbn_13, subjects, category:categories(slug)',
    )
    .eq('open_library_key', openLibraryKey)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const row = data as unknown as {
    open_library_key: string;
    title: string;
    subtitle: string | null;
    authors: string[];
    cover_url: string | null;
    first_publish_year: number | null;
    page_count: number | null;
    isbn_13: string | null;
    subjects: string[];
    category: { slug: string } | null;
  };
  const slug = row.category?.slug;
  return {
    openLibraryKey: row.open_library_key,
    title: row.title,
    subtitle: row.subtitle,
    authors: row.authors,
    coverUrl: row.cover_url,
    firstPublishYear: row.first_publish_year,
    pageCount: row.page_count,
    isbn13: row.isbn_13,
    subjects: row.subjects,
    suggestedCategory: slug && isCategorySlug(slug) ? slug : null,
  };
}

/** Add a book to the shared catalog (or find it there) and return our book id. */
export async function ensureCatalogBook(book: BookSearchResult): Promise<string> {
  const { data, error } = await supabase.rpc('upsert_open_library_book', {
    p_open_library_key: book.openLibraryKey,
    p_title: book.title,
    p_subtitle: book.subtitle,
    p_authors: book.authors,
    p_cover_url: book.coverUrl,
    p_subjects: book.subjects.slice(0, 100),
    p_first_publish_year: book.firstPublishYear,
    p_page_count: book.pageCount,
    p_isbn_13: book.isbn13,
    p_default_category_slug: book.suggestedCategory,
  });
  if (error) throw error;
  return data as string;
}

/**
 * Put a book on a shelf. Moving a ranked book off the Read shelf removes it
 * from its ranked list first, since only read books can be ranked.
 */
export async function setShelf(userId: string, book: BookSearchResult, status: ReadingStatus): Promise<void> {
  const bookId = await ensureCatalogBook(book);

  const { data: existing, error: readError } = await supabase
    .from('user_books')
    .select('status, bucket')
    .eq('user_id', userId)
    .eq('book_id', bookId)
    .maybeSingle();
  if (readError) throw readError;

  if (!existing) {
    const { error } = await supabase.from('user_books').insert({ user_id: userId, book_id: bookId, status });
    if (error) throw error;
    return;
  }
  if (existing.status === status) return;

  if (existing.bucket && status !== 'read') {
    const { error } = await supabase.rpc('unrank_book', { p_book_id: bookId });
    if (error) throw error;
  }
  const { error } = await supabase
    .from('user_books')
    .update({ status })
    .eq('user_id', userId)
    .eq('book_id', bookId);
  if (error) throw error;
}

export async function removeFromLibrary(userId: string, bookId: string): Promise<void> {
  const { error } = await supabase.from('user_books').delete().eq('user_id', userId).eq('book_id', bookId);
  if (error) throw error;
}
