import { createOpenLibraryClient, OpenLibraryError } from '../openLibrary';

function mockFetch(body: unknown, status = 200) {
  return jest.fn(async () => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  })) as unknown as jest.MockedFunction<typeof fetch>;
}

const duneDoc = {
  key: '/works/OL893415W',
  title: 'Dune',
  author_name: ['Frank Herbert'],
  cover_i: 11481354,
  first_publish_year: 1965,
  subject: ['Science fiction', 'Fiction, science fiction, general'],
  isbn: ['0441172717', '9780441172719'],
  number_of_pages_median: 604,
};

describe('search', () => {
  it('builds the request and normalizes results', async () => {
    const fetchImpl = mockFetch({ numFound: 2, docs: [duneDoc, { key: '/works/OL1W' }] });
    const client = createOpenLibraryClient({ fetchImpl });

    const results = await client.search('  dune ');

    const url = new URL(String(fetchImpl.mock.calls[0][0]));
    expect(url.pathname).toBe('/search.json');
    expect(url.searchParams.get('q')).toBe('dune');
    expect(url.searchParams.get('fields')).toContain('cover_i');

    // The doc without a title is dropped.
    expect(results).toEqual([
      {
        openLibraryKey: '/works/OL893415W',
        title: 'Dune',
        subtitle: null,
        authors: ['Frank Herbert'],
        coverUrl: 'https://covers.openlibrary.org/b/id/11481354-M.jpg',
        firstPublishYear: 1965,
        pageCount: 604,
        isbn13: '9780441172719',
        subjects: duneDoc.subject,
        suggestedCategory: 'sff',
      },
    ]);
  });

  it('moves obscure and derivative records below the real book, otherwise keeping order', async () => {
    // Shaped like the real top 3 results for "Becoming Michelle Obama".
    const docs = [
      { key: '/works/OL29922995W', title: 'Becoming Michelle Obama', edition_count: 1 },
      { key: '/works/OL17930367W', title: 'Becoming', edition_count: 44, cover_i: 8824664 },
      { key: '/works/OL25607554W', title: 'Summary of Becoming by Michelle Obama', edition_count: 1 },
      { key: '/works/OL4W', title: 'Becoming (Another)', edition_count: 5 },
    ];
    const client = createOpenLibraryClient({ fetchImpl: mockFetch({ docs }) });
    const keys = (await client.search('becoming michelle obama')).map((b) => b.openLibraryKey);
    expect(keys).toEqual(['/works/OL17930367W', '/works/OL4W', '/works/OL29922995W', '/works/OL25607554W']);
  });

  it('skips the network for queries shorter than 2 characters', async () => {
    const fetchImpl = mockFetch({ docs: [] });
    const client = createOpenLibraryClient({ fetchImpl });
    expect(await client.search(' d ')).toEqual([]);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('handles missing optional fields', async () => {
    const client = createOpenLibraryClient({
      fetchImpl: mockFetch({ docs: [{ key: '/works/OL2W', title: 'Bare' }] }),
    });
    const [book] = await client.search('bare');
    expect(book).toMatchObject({ authors: [], coverUrl: null, isbn13: null, suggestedCategory: null });
  });

  it('throws OpenLibraryError on HTTP errors', async () => {
    const client = createOpenLibraryClient({ fetchImpl: mockFetch({}, 503) });
    await expect(client.search('dune')).rejects.toMatchObject({ name: 'OpenLibraryError', status: 503 });
  });

  it('wraps network failures but passes aborts through', async () => {
    const failing = jest.fn(async () => {
      throw new TypeError('Network request failed');
    }) as unknown as typeof fetch;
    await expect(createOpenLibraryClient({ fetchImpl: failing }).search('dune')).rejects.toBeInstanceOf(
      OpenLibraryError,
    );

    const aborted = jest.fn(async () => {
      throw Object.assign(new Error('aborted'), { name: 'AbortError' });
    }) as unknown as typeof fetch;
    await expect(createOpenLibraryClient({ fetchImpl: aborted }).search('dune')).rejects.toMatchObject({
      name: 'AbortError',
    });
  });
});

describe('getWork', () => {
  it('reads both description formats', async () => {
    const asObject = createOpenLibraryClient({
      fetchImpl: mockFetch({ description: { type: '/type/text', value: ' Spice. ' }, subjects: ['Arrakis'] }),
    });
    expect(await asObject.getWork('/works/OL893415W')).toEqual({
      openLibraryKey: '/works/OL893415W',
      description: 'Spice.',
      subjects: ['Arrakis'],
    });

    const asString = createOpenLibraryClient({ fetchImpl: mockFetch({ description: 'Plain.' }) });
    expect((await asString.getWork('/works/OL1W')).description).toBe('Plain.');
  });

  it('rejects keys that are not work keys', async () => {
    const client = createOpenLibraryClient({ fetchImpl: mockFetch({}) });
    await expect(client.getWork('/authors/OL1A')).rejects.toThrow(/Not a work key/);
  });
});
