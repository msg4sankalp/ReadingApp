/**
 * Library backend on Supabase. All writes go through Row Level Security, and
 * ranking fields are written only by the rank_book()/unrank_book() database
 * functions (supabase/migrations).
 */

import type { BookSearchResult } from '@/lib/books/openLibrary';
import { isCategorySlug, type CategorySlug } from '@/lib/catalog/categories';
import type { Bucket } from '@/lib/ranking';
import { supabase } from '@/lib/supabase/client';

import { datesForShelfChange, localDateString } from './readingDates';
import type { LibraryBackend, LibraryEntry, RankedBook, ReadingStatus } from './types';

const ENTRY_SELECT = `
  book_id, status, bucket, rank_position, score, started_at, finished_at, updated_at,
  category:categories(slug),
  chips:user_book_chips(chip:category_chips(slug)),
  book:books!inner(title, authors, cover_url, open_library_key)
`;

interface EntryRow {
  book_id: string;
  status: ReadingStatus;
  bucket: Bucket | null;
  rank_position: number | null;
  score: number | string | null;
  started_at: string | null;
  finished_at: string | null;
  updated_at: string;
  category: { slug: string } | null;
  chips: { chip: { slug: string } | null }[] | null;
  book: { title: string; authors: string[]; cover_url: string | null; open_library_key: string | null };
}

function toEntry(row: EntryRow): LibraryEntry {
  const slug = row.category?.slug;
  return {
    bookId: row.book_id,
    status: row.status,
    category: slug && isCategorySlug(slug) ? slug : null,
    bucket: row.bucket,
    rankPosition: row.rank_position,
    score: row.score === null ? null : Number(row.score),
    chips: (row.chips ?? []).flatMap((c) => (c.chip ? [c.chip.slug] : [])),
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    updatedAt: row.updated_at,
    book: {
      title: row.book.title,
      authors: row.book.authors,
      coverUrl: row.book.cover_url,
      openLibraryKey: row.book.open_library_key,
    },
  };
}

export function createSupabaseBackend(userId: string): LibraryBackend {
  async function ensureBook(book: BookSearchResult): Promise<string> {
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

  return {
    kind: 'supabase',

    async fetchLibrary() {
      const { data, error } = await supabase
        .from('user_books')
        .select(ENTRY_SELECT)
        .eq('user_id', userId)
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return ((data ?? []) as unknown as EntryRow[]).map(toEntry);
    },

    async fetchEntryForWork(openLibraryKey) {
      const { data, error } = await supabase
        .from('user_books')
        .select(ENTRY_SELECT)
        .eq('user_id', userId)
        .eq('book.open_library_key', openLibraryKey)
        .maybeSingle();
      if (error) throw error;
      return data ? toEntry(data as unknown as EntryRow) : null;
    },

    async fetchCatalogBookByWork(openLibraryKey) {
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
    },

    ensureBook,

    async setShelf(book, status) {
      const bookId = await ensureBook(book);
      const { data: existing, error: readError } = await supabase
        .from('user_books')
        .select('status, bucket, started_at, finished_at')
        .eq('user_id', userId)
        .eq('book_id', bookId)
        .maybeSingle();
      if (readError) throw readError;

      const today = localDateString();
      if (!existing) {
        const dates = datesForShelfChange(null, status, today);
        const { error } = await supabase.from('user_books').insert({
          user_id: userId,
          book_id: bookId,
          status,
          started_at: dates.startedAt,
          finished_at: dates.finishedAt,
        });
        if (error) throw error;
        return;
      }
      if (existing.status === status) return;
      const dates = datesForShelfChange(
        { status: existing.status, startedAt: existing.started_at, finishedAt: existing.finished_at },
        status,
        today,
      );

      // Only read books can be ranked.
      if (existing.bucket && status !== 'read') {
        const { error } = await supabase.rpc('unrank_book', { p_book_id: bookId });
        if (error) throw error;
      }
      const { error } = await supabase
        .from('user_books')
        .update({ status, started_at: dates.startedAt, finished_at: dates.finishedAt })
        .eq('user_id', userId)
        .eq('book_id', bookId);
      if (error) throw error;
    },

    async fetchRankedList(category: CategorySlug, bucket: Bucket): Promise<RankedBook[]> {
      const { data, error } = await supabase
        .from('user_books')
        .select('book_id, rank_position, category:categories!inner(slug), book:books!inner(title, authors, cover_url)')
        .eq('user_id', userId)
        .eq('category.slug', category)
        .eq('bucket', bucket)
        .not('rank_position', 'is', null)
        .order('rank_position');
      if (error) throw error;
      const rows = (data ?? []) as unknown as {
        book_id: string;
        book: { title: string; authors: string[]; cover_url: string | null };
      }[];
      return rows.map((r) => ({
        bookId: r.book_id,
        title: r.book.title,
        authors: r.book.authors,
        coverUrl: r.book.cover_url,
      }));
    },

    async rankBook({ bookId, category, bucket, position, comparisons }) {
      const { data, error } = await supabase.rpc('rank_book', {
        p_book_id: bookId,
        p_category_slug: category,
        p_bucket: bucket,
        p_position: position,
        p_comparisons: comparisons,
      });
      if (error) throw error;
      return Number(data);
    },

    async unrankBook(bookId) {
      const { error } = await supabase.rpc('unrank_book', { p_book_id: bookId });
      if (error) throw error;
    },

    async setChips(bookId, category, chipSlugs) {
      const { error: deleteError } = await supabase
        .from('user_book_chips')
        .delete()
        .eq('user_id', userId)
        .eq('book_id', bookId);
      if (deleteError) throw deleteError;
      if (chipSlugs.length === 0) return;

      const { data: chips, error: chipError } = await supabase
        .from('category_chips')
        .select('id, category:categories!inner(slug)')
        .eq('category.slug', category)
        .in('slug', chipSlugs);
      if (chipError) throw chipError;

      const rows = (chips ?? []).map((c) => ({ user_id: userId, book_id: bookId, chip_id: c.id as number }));
      const { error } = await supabase.from('user_book_chips').insert(rows);
      if (error) throw error;
    },
  };
}
