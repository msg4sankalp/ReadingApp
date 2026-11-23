/**
 * Suggest a default ranking category from a book's Open Library subjects.
 *
 * Open Library subjects are messy free text ("Fiction, science fiction,
 * general", "Detective and mystery stories", "World War, 1939-1945", ...).
 * This is a deliberately simple rule-based first pass. The user always confirms
 * or changes the category when ranking, and an LLM classifier can replace this
 * later (see PLAN.md).
 */

import { CATEGORIES, type CategorySlug } from './categories';

interface Rule {
  category: CategorySlug;
  pattern: RegExp;
  weight: number;
}

const RULES: Rule[] = [
  // Formats override genre: a graphic memoir is ranked with graphic novels.
  { category: 'graphic-novels', pattern: /graphic novel|comic|manga|cartoons and comics/, weight: 6 },
  { category: 'poetry', pattern: /\bpoe(try|ms)\b|\bverse\b|\bsonnets?\b/, weight: 5 },

  // Fiction genres
  { category: 'historical-fiction', pattern: /historical fiction|fiction,? historical|historical novel/, weight: 4 },
  { category: 'sff', pattern: /science fiction|fantasy|space opera|dystopia|cyberpunk|time travel|dragons|magic|wizards/, weight: 3 },
  { category: 'mystery-thriller', pattern: /myster|detective|thriller|suspense|crime|murder|espionage|spy stories/, weight: 3 },
  { category: 'romance', pattern: /romance|love stories|romantic/, weight: 3 },
  { category: 'horror', pattern: /horror|ghost stories|supernatural|vampires|zombies|haunted/, weight: 3 },
  { category: 'literary-fiction', pattern: /literary fiction|fiction,? literary|domestic fiction|psychological fiction|coming of age|bildungsroman/, weight: 2 },

  // Nonfiction
  { category: 'memoir-biography', pattern: /biograph|autobiograph|memoir|personal narratives|diaries|correspondence/, weight: 3 },
  { category: 'business-self-improvement', pattern: /self-help|self-improvement|success|business|management|leadership|personal finance|productivity|entrepreneur|habits/, weight: 3 },
  { category: 'science-nature', pattern: /\bscience\b|physics|biology|chemistry|astronomy|evolution|mathematics|technology|computers|nature|natural history|ecology|medicine|neuroscience|psychology/, weight: 2 },
  { category: 'society-ideas', pattern: /politic|sociology|social|economics|philosophy|religion|feminism|race relations|current events|law|ethics|essays/, weight: 2 },
  { category: 'history', pattern: /\bhistory\b|world war|civilization|ancient|medieval|revolution|\d{4}-\d{4}/, weight: 2 },
];

const FICTION_HINT = /\bfiction\b|\bnovels?\b|\bstories\b|\btales\b/;
const NONFICTION_HINT = /\bnonfiction\b|\bnon-fiction\b/;
/** "Juvenile nonfiction" etc. mention fiction without being fiction. */
const NOT_FICTION = /non-?fiction/;

const FICTION_CATEGORIES = new Set<CategorySlug>(
  CATEGORIES.filter((c) => c.group === 'fiction').map((c) => c.slug),
);
const NONFICTION_CATEGORIES = new Set<CategorySlug>(
  CATEGORIES.filter((c) => c.group === 'nonfiction').map((c) => c.slug),
);
const CATEGORY_ORDER = new Map(CATEGORIES.map((c, i) => [c.slug, i]));

export interface CategorySuggestion {
  category: CategorySlug;
  /** Total rule weight behind the suggestion; higher means more confident. */
  strength: number;
}

export function suggestCategory(subjects: readonly string[]): CategorySuggestion | null {
  const normalized = subjects.map((s) => s.toLowerCase().trim()).filter(Boolean);
  if (normalized.length === 0) return null;

  const isFiction = normalized.some((s) => FICTION_HINT.test(s) && !NOT_FICTION.test(s));
  const isNonfiction = normalized.some((s) => NONFICTION_HINT.test(s));

  const totals = new Map<CategorySlug, number>();
  for (const subject of normalized) {
    for (const rule of RULES) {
      if (rule.pattern.test(subject)) {
        totals.set(rule.category, (totals.get(rule.category) ?? 0) + rule.weight);
      }
    }
  }

  // A novel set in WW2 is historical fiction, not history. A history of
  // espionage is not a thriller.
  for (const slug of [...totals.keys()]) {
    if (isFiction && !isNonfiction && NONFICTION_CATEGORIES.has(slug)) totals.delete(slug);
    if (isNonfiction && !isFiction && FICTION_CATEGORIES.has(slug)) totals.delete(slug);
  }
  if (isFiction && !isNonfiction && totals.size === 0) {
    const historyHint = normalized.some((s) => /\bhistory\b|world war|\d{4}-\d{4}/.test(s));
    return { category: historyHint ? 'historical-fiction' : 'literary-fiction', strength: 1 };
  }

  let best: CategorySuggestion | null = null;
  for (const [category, strength] of totals) {
    if (
      !best ||
      strength > best.strength ||
      (strength === best.strength && CATEGORY_ORDER.get(category)! < CATEGORY_ORDER.get(best.category)!)
    ) {
      best = { category, strength };
    }
  }
  return best;
}
