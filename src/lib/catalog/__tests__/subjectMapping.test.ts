import { CATEGORIES, getCategory, isCategorySlug } from '../categories';
import { suggestCategory } from '../subjectMapping';

describe('suggestCategory', () => {
  // Subject lists modeled on real Open Library records.
  const cases: [string, string[], string][] = [
    ['Dune', ['Science fiction', 'Fiction, science fiction, general', 'Dune (Imaginary place)'], 'sff'],
    ['The Hobbit', ['Fantasy fiction', 'Middle Earth (Imaginary place)', 'Fiction'], 'sff'],
    ['Gone Girl', ['Fiction', 'Missing persons', 'Fiction, thrillers, suspense', 'Psychological fiction'], 'mystery-thriller'],
    ['Pride and Prejudice (older record)', ['Love stories', 'Courtship', 'Domestic fiction', 'England, fiction'], 'romance'],
    ['The Shining', ['Fiction', 'Horror tales', 'Haunted hotels'], 'horror'],
    ['All the Light We Cannot See', ['World War, 1939-1945', 'Fiction', 'Historical fiction'], 'historical-fiction'],
    ['Untagged WW2 novel', ['World War, 1939-1945', 'Fiction'], 'historical-fiction'],
    ['Educated', ['Autobiography', 'Biography', 'Idaho', 'Survivalism'], 'memoir-biography'],
    ['The Guns of August', ['World War, 1914-1918', 'History', 'Campaigns'], 'history'],
    ['Sapiens', ['Human beings', 'Civilization', 'History', 'Human evolution'], 'history'],
    ['A Brief History of Time', ['Cosmology', 'Astronomy', 'Science'], 'science-nature'],
    ['Atomic Habits', ['Habits', 'Self-help', 'Success'], 'business-self-improvement'],
    ['Milk and Honey', ['Poetry', 'American poetry'], 'poetry'],
    ['Maus', ['Graphic novels', 'Holocaust, Jewish (1939-1945)', 'Biography', 'Comic books, strips, etc.'], 'graphic-novels'],
    ['Beloved', ['Fiction', 'Psychological fiction', 'Slavery'], 'literary-fiction'],
    ['Generic novel', ['Fiction'], 'literary-fiction'],
    // Real Open Library subjects (November 2026). Historical setting, but horror.
    ['Mexican Gothic', ['English literature', 'nyt:combined-print-and-e-book-fiction=2020-07-19',
      'New York Times bestseller', 'Fiction, gothic', 'Fiction, historical', 'Mexico, fiction',
      'Fiction, historical, general', 'Haunted houses', 'Fiction', 'Families', 'Family secrets', 'Gothic',
      'Horror', 'Ghosts', 'Historical Fiction', 'Mystery', 'Fantasy', 'Thriller', 'Historical'], 'horror'],
    // A graphic memoir is ranked with graphic novels.
    ['Persepolis', ['Comic books, strips, etc.', 'Graphic novels', 'Autobiography', 'Biography', 'Iran',
      'Women', 'Revolution', 'History', 'Childhood', 'Islam'], 'graphic-novels'],
    // A popular book with a few stray subjects from its graphic adaptation is not a graphic novel.
    ['The Hobbit (with adaptation subjects)', ['Fantasy', 'Fantasy fiction', 'Fiction', 'Dragons', 'Wizards',
      'Graphic novels', 'Comic books, strips', ...Array.from({ length: 30 }, (_, i) => `Topic ${i}`)], 'sff'],
    // Historical romance competes with romance.
    ['Pride and Prejudice', ['Fiction, Romance, Historical, Regency', 'Love stories', 'Historical fiction'], 'romance'],
  ];

  it.each(cases)('%s', (_title, subjects, expected) => {
    expect(suggestCategory(subjects)?.category).toBe(expected);
  });

  it('returns null when there is nothing to go on', () => {
    expect(suggestCategory([])).toBeNull();
    expect(suggestCategory(['', '  '])).toBeNull();
    expect(suggestCategory(['Accessible book', 'Protected DAISY'])).toBeNull();
  });

  it('only ever suggests known categories', () => {
    const suggestion = suggestCategory(['Science fiction', 'History', 'Poetry']);
    expect(suggestion && isCategorySlug(suggestion.category)).toBe(true);
  });
});

describe('categories', () => {
  it('have unique slugs, and unique chip slugs within each category', () => {
    expect(new Set(CATEGORIES.map((c) => c.slug)).size).toBe(CATEGORIES.length);
    for (const c of CATEGORIES) {
      expect(new Set(c.chips.map((ch) => ch.slug)).size).toBe(c.chips.length);
      expect(c.chips.length).toBeGreaterThan(0);
    }
  });

  it('look up by slug', () => {
    expect(getCategory('sff').name).toBe('Science Fiction & Fantasy');
    expect(isCategorySlug('cookbooks')).toBe(false);
  });
});
