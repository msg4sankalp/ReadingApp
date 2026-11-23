/**
 * Open Library client: free, no API key.
 * Docs: https://openlibrary.org/dev/docs/api/search
 *
 * Results are normalized into `BookSearchResult`, our own shape, so the rest of
 * the app never depends on Open Library's field names. Later sources (Google
 * Books) can map into the same shape.
 */

import { suggestCategory } from '../catalog/subjectMapping';
import type { CategorySlug } from '../catalog/categories';

const BASE_URL = 'https://openlibrary.org';
const COVERS_URL = 'https://covers.openlibrary.org';

const SEARCH_FIELDS = [
  'key',
  'title',
  'subtitle',
  'author_name',
  'cover_i',
  'first_publish_year',
  'subject',
  'isbn',
  'number_of_pages_median',
].join(',');

export interface BookSearchResult {
  /** Open Library work key, e.g. "/works/OL45804W". */
  openLibraryKey: string;
  title: string;
  subtitle: string | null;
  authors: string[];
  coverUrl: string | null;
  firstPublishYear: number | null;
  pageCount: number | null;
  isbn13: string | null;
  subjects: string[];
  suggestedCategory: CategorySlug | null;
}

export interface WorkDetails {
  openLibraryKey: string;
  description: string | null;
  subjects: string[];
}

export type CoverSize = 'S' | 'M' | 'L';

export class OpenLibraryError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'OpenLibraryError';
  }
}

/** Raw search doc, typed loosely: every field can be missing. */
interface RawSearchDoc {
  key?: string;
  title?: string;
  subtitle?: string;
  author_name?: string[];
  cover_i?: number;
  first_publish_year?: number;
  subject?: string[];
  isbn?: string[];
  number_of_pages_median?: number;
}

interface RawWork {
  key?: string;
  description?: string | { type?: string; value?: string };
  subjects?: string[];
}

type Fetch = typeof fetch;

export interface OpenLibraryClientOptions {
  fetchImpl?: Fetch;
  baseUrl?: string;
}

export function createOpenLibraryClient(options: OpenLibraryClientOptions = {}) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const baseUrl = options.baseUrl ?? BASE_URL;

  async function getJson<T>(path: string, signal?: AbortSignal): Promise<T> {
    let res: Response;
    try {
      res = await fetchImpl(`${baseUrl}${path}`, { signal, headers: { Accept: 'application/json' } });
    } catch (e) {
      if ((e as Error)?.name === 'AbortError') throw e;
      throw new OpenLibraryError(`Network error: ${(e as Error)?.message ?? String(e)}`);
    }
    if (!res.ok) {
      throw new OpenLibraryError(`Open Library responded with ${res.status}`, res.status);
    }
    return (await res.json()) as T;
  }

  return {
    async search(
      query: string,
      { limit = 20, signal }: { limit?: number; signal?: AbortSignal } = {},
    ): Promise<BookSearchResult[]> {
      const q = query.trim();
      if (q.length < 2) return [];
      const params = new URLSearchParams({ q, fields: SEARCH_FIELDS, limit: String(limit) });
      const data = await getJson<{ docs?: RawSearchDoc[] }>(`/search.json?${params}`, signal);
      return (data.docs ?? []).map(normalizeSearchDoc).filter((b): b is BookSearchResult => b !== null);
    },

    async getWork(openLibraryKey: string, { signal }: { signal?: AbortSignal } = {}): Promise<WorkDetails> {
      if (!/^\/works\/OL\d+W$/.test(openLibraryKey)) {
        throw new OpenLibraryError(`Not a work key: ${openLibraryKey}`);
      }
      const data = await getJson<RawWork>(`${openLibraryKey}.json`, signal);
      return {
        openLibraryKey,
        description: normalizeDescription(data.description),
        subjects: data.subjects ?? [],
      };
    },
  };
}

export const openLibrary = createOpenLibraryClient();

export function coverUrl(coverId: number, size: CoverSize = 'M'): string {
  return `${COVERS_URL}/b/id/${coverId}-${size}.jpg`;
}

export function normalizeSearchDoc(doc: RawSearchDoc): BookSearchResult | null {
  if (!doc.key || !doc.title) return null;
  const subjects = doc.subject ?? [];
  return {
    openLibraryKey: doc.key,
    title: doc.title,
    subtitle: doc.subtitle ?? null,
    authors: doc.author_name ?? [],
    coverUrl: doc.cover_i ? coverUrl(doc.cover_i) : null,
    firstPublishYear: doc.first_publish_year ?? null,
    pageCount: doc.number_of_pages_median ?? null,
    isbn13: pickIsbn13(doc.isbn ?? []),
    subjects,
    suggestedCategory: suggestCategory(subjects)?.category ?? null,
  };
}

function pickIsbn13(isbns: string[]): string | null {
  return isbns.find((i) => /^97[89]\d{10}$/.test(i)) ?? null;
}

/** Work descriptions are either a string or `{ type: "/type/text", value }`. */
function normalizeDescription(d: RawWork['description']): string | null {
  const text = typeof d === 'string' ? d : d?.value;
  const trimmed = text?.trim();
  return trimmed ? trimmed : null;
}
