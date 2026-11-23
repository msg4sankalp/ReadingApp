/**
 * Ranking categories: the fixed, coarse set of genres that books are ranked
 * within. Head-to-head comparisons only happen inside one category.
 *
 * This file is the source of truth for the app. The seed in
 * supabase/seed.sql must match it (a test checks this).
 */

export type CategorySlug =
  | 'literary-fiction'
  | 'sff'
  | 'mystery-thriller'
  | 'romance'
  | 'horror'
  | 'historical-fiction'
  | 'memoir-biography'
  | 'history'
  | 'science-nature'
  | 'society-ideas'
  | 'business-self-improvement'
  | 'poetry'
  | 'graphic-novels';

export interface Chip {
  slug: string;
  label: string;
}

export interface Category {
  slug: CategorySlug;
  name: string;
  /** For tight spaces, e.g. genre bubbles. */
  shortName: string;
  group: 'fiction' | 'nonfiction' | 'other';
  /** "What made it work?" options shown after ranking a book in this category. */
  chips: Chip[];
}

const chip = (label: string): Chip => ({
  slug: label.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
  label,
});

const chips = (...labels: string[]) => labels.map(chip);

export const CATEGORIES: readonly Category[] = [
  { slug: 'literary-fiction', name: 'Literary & General Fiction', shortName: 'Literary', group: 'fiction',
    chips: chips('Prose', 'Characters', 'Themes', 'Emotional impact', 'Structure') },
  { slug: 'sff', name: 'Science Fiction & Fantasy', shortName: 'Sci-Fi & Fantasy', group: 'fiction',
    chips: chips('Ideas', 'World-building', 'Characters', 'Plot', 'Prose') },
  { slug: 'mystery-thriller', name: 'Mystery & Thriller', shortName: 'Mystery', group: 'fiction',
    chips: chips('Twists', 'Pacing', 'Atmosphere', 'Detective', 'Ending') },
  { slug: 'romance', name: 'Romance', shortName: 'Romance', group: 'fiction',
    chips: chips('Chemistry', 'Tropes', 'Banter', 'Spice level', 'Emotional payoff') },
  { slug: 'horror', name: 'Horror', shortName: 'Horror', group: 'fiction',
    chips: chips('Dread', 'Scares', 'Atmosphere', 'Characters', 'Ending') },
  { slug: 'historical-fiction', name: 'Historical Fiction', shortName: 'Historical', group: 'fiction',
    chips: chips('Setting', 'Characters', 'Research', 'Plot', 'Emotional impact') },
  { slug: 'memoir-biography', name: 'Memoir & Biography', shortName: 'Memoir', group: 'nonfiction',
    chips: chips('Voice', 'Life story', 'Insight', 'Honesty', 'Humor') },
  { slug: 'history', name: 'History', shortName: 'History', group: 'nonfiction',
    chips: chips('Narrative', 'Research depth', 'New perspective', 'Readability') },
  { slug: 'science-nature', name: 'Science, Tech & Nature', shortName: 'Science', group: 'nonfiction',
    chips: chips('Big ideas', 'Clarity', 'Wonder', 'Practical takeaways', 'Storytelling') },
  { slug: 'society-ideas', name: 'Society, Politics & Ideas', shortName: 'Ideas & Society', group: 'nonfiction',
    chips: chips('Argument', 'Changed my mind', 'Research', 'Timeliness', 'Readability') },
  { slug: 'business-self-improvement', name: 'Business & Self-Improvement', shortName: 'Self-Improvement', group: 'nonfiction',
    chips: chips('Actionable', 'Frameworks', 'Examples', 'Motivating', 'Concise') },
  { slug: 'poetry', name: 'Poetry', shortName: 'Poetry', group: 'other',
    chips: chips('Language', 'Imagery', 'Emotion', 'Form', 'Memorable lines') },
  { slug: 'graphic-novels', name: 'Graphic Novels & Comics', shortName: 'Graphic Novels', group: 'other',
    chips: chips('Art', 'Story', 'Characters', 'Panel craft', 'World-building') },
];

const BY_SLUG = new Map(CATEGORIES.map((c) => [c.slug, c]));

export function getCategory(slug: CategorySlug): Category {
  const c = BY_SLUG.get(slug);
  if (!c) throw new Error(`Unknown category: ${slug}`);
  return c;
}

export function isCategorySlug(value: string): value is CategorySlug {
  return BY_SLUG.has(value as CategorySlug);
}
