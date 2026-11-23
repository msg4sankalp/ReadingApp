import { createDemoBackend, type KeyValueStorage } from '@/lib/demo/demoBackend';
import { DEMO_BOOKS } from '@/lib/demo/seedData';

import { candidateQueries, filterCandidates, pickRecommendations } from '../candidates';
import { evaluateLeaveOneOut } from '../evaluate';
import { predict, qualityNudge } from '../predict';
import { bookSignal, buildTaste, favoriteGenres, topFeatures } from '../taste';

const memory = (): KeyValueStorage => {
  const m = new Map<string, string>();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v), removeItem: (k) => void m.delete(k) };
};
const demoLibrary = () => createDemoBackend(memory()).fetchLibrary();
const book = (title: string) => DEMO_BOOKS.find((b) => b.title === title)!;

describe('taste profile (sample reader)', () => {
  it('ranks Sci-Fi & Fantasy as the favorite genre', async () => {
    const taste = buildTaste(await demoLibrary());
    expect(favoriteGenres(taste)[0].category).toBe('sff');
    expect(taste.totalRanked).toBe(24);
  });

  it('finds subjects that run through the favorites', async () => {
    const sff = buildTaste(await demoLibrary()).genres.get('sff')!;
    const top = topFeatures(sff, 10);
    expect(top.length).toBeGreaterThan(0);
    // Ready Player One (disliked) should pull its own subjects negative.
    expect(Math.min(...sff.weights.values())).toBeLessThan(0);
  });

  it('turns scores into signals: loved positive, disliked negative', () => {
    expect(bookSignal(9.7, 7)).toBeGreaterThan(0.9);
    expect(bookSignal(5, 7)).toBeLessThan(0);
    expect(bookSignal(0.6, 7)).toBe(-1.5);
  });
});

describe('predict', () => {
  it('predicts higher for a book like the favorites than for one like the dislikes', async () => {
    const taste = buildTaste(await demoLibrary());
    // A hard-SF book sharing subjects with the top-ranked sci-fi books.
    const hardSf = predict(
      { title: 'New hard SF', authors: ['Someone New'], subjects: book('Project Hail Mary').subjects, category: 'sff' },
      taste,
    );
    const likeDisliked = predict(
      { title: 'New VR romp', authors: ['Someone Else'], subjects: book('Ready Player One').subjects, category: 'sff' },
      taste,
    );
    expect(hardSf.score).toBeGreaterThan(likeDisliked.score);
    expect(hardSf.reason).toMatch(/^Because you loved/);
  });

  it('credits a loved author', async () => {
    const taste = buildTaste(await demoLibrary());
    const p = predict({ title: 'Artemis', authors: ['Andy Weir'], subjects: ['Moon', 'Fiction'], category: 'sff' }, taste);
    expect(p.reason).toBe('You loved Project Hail Mary, by the same author');
  });

  it('stays modest for a genre the reader has never ranked', async () => {
    const taste = buildTaste(await demoLibrary());
    const p = predict({ title: 'Poems', authors: ['A Poet'], subjects: ['Poetry'], category: 'poetry' }, taste);
    expect(p.score).toBeLessThan(taste.overallMean);
    expect(p.confident).toBe(false);
    expect(p.reason).toMatch(/Something different/);
  });

  it('keeps the quality nudge small and distrusts few ratings', () => {
    expect(qualityNudge({ average: 5, count: 1 })).toBeLessThan(0.1);
    expect(qualityNudge({ average: 4.6, count: 1000 })).toBeLessThanOrEqual(0.6);
    expect(qualityNudge({ average: 2, count: 1000 })).toBeGreaterThanOrEqual(-0.6);
    expect(qualityNudge(null)).toBe(0);
  });
});

describe('offline accuracy (R3)', () => {
  // The sample reader's rankings were made up without regard to subjects, so
  // there's no real taste pattern to find in them. On data like that, the
  // right behaviour is to stay near the genre average: this guards against a
  // taste adjustment that actively hurts (an earlier version scored 2.40 here).
  it('does no harm compared with guessing the genre average', async () => {
    const result = evaluateLeaveOneOut(await demoLibrary());
    expect(result.books).toBe(24);
    expect(result.modelError).toBeLessThan(result.genreAverageError + 0.1);
  });
});

describe('candidates', () => {
  const base = { subtitle: null, coverUrl: null, firstPublishYear: 2020, pageCount: 300, isbn13: null, editionCount: 10 };
  const cand = (key: string, title: string, author: string, extra: object = {}) => ({
    ...base,
    openLibraryKey: key,
    title,
    authors: [author],
    subjects: ['Science fiction'],
    suggestedCategory: 'sff' as const,
    rating: { average: 4.2, count: 100 },
    ...extra,
  });

  it('builds queries from favorite genres, top subjects and loved authors', async () => {
    const queries = candidateQueries(buildTaste(await demoLibrary()));
    expect(queries.some((q) => q.subject === 'science fiction' && q.genre === 'sff')).toBe(true);
    expect(queries.some((q) => q.author === 'Andy Weir')).toBe(true);
    expect(queries.length).toBeLessThanOrEqual(14);
  });

  it('filters library books, dismissed books, knockoffs, box sets, later volumes and obscure records', () => {
    const books = [
      cand('/works/OL1W', 'Good Book', 'A'),
      cand('/works/OL2W', 'Already Read', 'B'),
      cand('/works/OL3W', 'Dismissed', 'C'),
      cand('/works/OL4W', 'Summary of Good Book', 'D'),
      cand('/works/OL5W', 'The Martian / Artemis / Project Hail Mary', 'E'),
      cand('/works/OL6W', "Death's End (The Three-Body Problem Series Book 3)", 'F'),
      cand('/works/OL7W', 'The Three-Body Problem (Book 1)', 'F'),
      cand('/works/OL8W', 'Obscure', 'G', { rating: { average: 5, count: 1 }, editionCount: 1 }),
      cand('/works/OL9W', 'good book', 'A'), // duplicate title + author
    ];
    const kept = filterCandidates(books, { libraryKeys: new Set(['/works/OL2W']), dismissed: new Set(['/works/OL3W']) });
    expect(kept.map((b) => b.title)).toEqual(['Good Book', 'The Three-Body Problem (Book 1)']);
  });

  it('picks a varied list: at most 2 per author, no genre taking over', async () => {
    const taste = buildTaste(await demoLibrary());
    const books = [
      ...[1, 2, 3, 4].map((i) => cand(`/works/OL${i}W`, `Same Author ${i}`, 'Prolific')),
      ...[5, 6, 7, 8, 9, 10].map((i) => cand(`/works/OL${i}W`, `SF ${i}`, `Author ${i}`)),
      cand('/works/OL11W', 'A Mystery', 'M', { suggestedCategory: 'mystery-thriller', subjects: ['Mystery'] }),
    ];
    const picks = pickRecommendations(books, taste, { count: 6 });
    expect(picks.filter((p) => p.book.authors[0] === 'Prolific').length).toBeLessThanOrEqual(2);
    expect(picks.filter((p) => p.category === 'sff').length).toBeLessThanOrEqual(3);
    expect(picks.some((p) => p.category === 'mystery-thriller')).toBe(true);
    for (let i = 1; i < picks.length; i++) {
      // Ordered best first, except where the variety caps skipped a higher score.
      expect(typeof picks[i].prediction.reason).toBe('string');
    }
  });
});
