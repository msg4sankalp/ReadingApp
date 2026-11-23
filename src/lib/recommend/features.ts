/**
 * Turn a book's Open Library subjects and authors into clean "features" the
 * taste model can compare, e.g. ["hard science fiction", "space", "author:andy weir"].
 *
 * Open Library subjects are noisy: bestseller-list tags, library markers,
 * other languages, and compound entries like "Fiction, science fiction, general".
 */

/** Whole subjects to drop: shelving and library noise, not content. */
const NOISE = [
  /^nyt:/,
  /new york times/,
  /best ?seller/,
  /accessible book/,
  /protected daisy/,
  /in library/,
  /lending library/,
  /large (type|print)/,
  /reading level/,
  /open library/,
  /staff picks/,
  /award/,
  /^collection:/,
  /^series:/,
  /book club/,
  /open_syllabus/,
  /translations? into/,
  /^\d{4}s?$/,
];

/** Parts of a compound subject that carry no meaning on their own. */
const FILLER = new Set([
  'fiction',
  'general',
  'literature',
  'novel',
  'novels',
  'juvenile fiction',
  'young adult fiction',
  'english literature',
  'american literature',
  'english fiction',
  'american fiction',
  'fiction in english',
  'literary',
  'contemporary',
  'popular works',
  'textbooks',
  'history and criticism',
  'criticism and interpretation',
  'description and travel',
  'biography & autobiography',
]);

/** Non-English subjects (Spanish/French/etc.), which mostly duplicate English ones. */
const NON_ENGLISH = /[áéíóúñçàèâêîôûäëïöü]|^(roman|romans|ficción|ficciones|fantasía|novela|littérature)\b/;

export function subjectFeatures(subjects: readonly string[]): string[] {
  const out = new Set<string>();
  for (const raw of subjects) {
    const s = raw.toLowerCase().trim();
    if (!s || NOISE.some((r) => r.test(s)) || NON_ENGLISH.test(s)) continue;
    for (let part of s.split(/\s*(?:,|--|\/)\s*/)) {
      part = part
        .replace(/\(.*?\)/g, '') // "Dune (Imaginary place)" → "dune"
        .replace(/\bsci-?fi\b/g, 'science fiction') // "hard sci-fi" → "hard science fiction"
        .replace(/(\w)-(\w)/g, '$1 $2') // "science-fiction" → "science fiction"
        .replace(/-+$/, '')
        .replace(/\s+/g, ' ')
        .trim();
      if (part.length < 3 || part.length > 40 || FILLER.has(part) || /^\d/.test(part)) continue;
      out.add(part);
    }
  }
  return [...out].slice(0, 40);
}

export const authorFeature = (name: string) => `author:${name.toLowerCase().trim()}`;

export function bookFeatures(book: { subjects: readonly string[]; authors: readonly string[] }): string[] {
  return [...subjectFeatures(book.subjects), ...book.authors.slice(0, 2).map(authorFeature)];
}

export const isAuthorFeature = (f: string) => f.startsWith('author:');
export const authorName = (f: string) => f.slice('author:'.length);
