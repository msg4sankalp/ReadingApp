import {
  BUCKETS,
  BUCKET_BANDS,
  formatScore,
  isProvisional,
  scoreForPosition,
  scoresForList,
} from '../scores';

describe('scoreForPosition', () => {
  it('puts a single book in the middle of its band', () => {
    expect(scoreForPosition('liked', 0, 1)).toBe(8.4); // (10 + 6.7) / 2 = 8.35, rounded half up
    expect(scoreForPosition('fine', 0, 1)).toBe(5);
    expect(scoreForPosition('disliked', 0, 1)).toBe(1.7); // 1.65, rounded half up
  });

  it('places each book in the middle of its share of the band', () => {
    expect(scoresForList('liked', 2)).toEqual([9.2, 7.5]);
    expect(scoresForList('liked', 4)).toEqual([9.6, 8.8, 7.9, 7.1]);
    expect(scoresForList('liked', 6)).toEqual([9.7, 9.2, 8.6, 8.1, 7.5, 7]);
    expect(scoresForList('disliked', 3)).toEqual([2.8, 1.7, 0.6]);
  });

  it('approaches the band edges as the list grows', () => {
    expect(scoreForPosition('liked', 0, 20)).toBe(9.9);
    expect(scoreForPosition('liked', 19, 20)).toBe(6.8);
    expect(scoreForPosition('liked', 0, 100)).toBe(10);
  });

  it('never increases down a list and stays inside the band', () => {
    for (const bucket of BUCKETS) {
      const { low, high } = BUCKET_BANDS[bucket];
      for (let n = 1; n <= 50; n++) {
        const scores = scoresForList(bucket, n);
        scores.forEach((s, i) => {
          expect(s).toBeGreaterThanOrEqual(low);
          expect(s).toBeLessThanOrEqual(high);
          if (i > 0) expect(s).toBeLessThanOrEqual(scores[i - 1]);
        });
      }
    }
  });

  it('keeps every liked book above every fine book, and every fine book above every disliked book', () => {
    const worstLiked = scoreForPosition('liked', 99, 100);
    const bestFine = scoreForPosition('fine', 0, 100);
    const worstFine = scoreForPosition('fine', 99, 100);
    const bestDisliked = scoreForPosition('disliked', 0, 100);
    expect(worstLiked).toBeGreaterThan(bestFine);
    expect(worstFine).toBeGreaterThan(bestDisliked);
  });

  it('rounds exact halves up, matching Postgres round() in bucket_score()', () => {
    // Exactly 8.35 and 2.75; floating point would give 8.3499… and 2.7499…
    expect(scoreForPosition('liked', 0, 1)).toBe(8.4);
    expect(scoreForPosition('disliked', 0, 3)).toBe(2.8);
  });

  it('rejects invalid input', () => {
    expect(() => scoreForPosition('liked', 0, 0)).toThrow(RangeError);
    expect(() => scoreForPosition('liked', 3, 3)).toThrow(RangeError);
    expect(() => scoreForPosition('liked', -1, 3)).toThrow(RangeError);
    expect(() => scoreForPosition('liked', 0.5, 3)).toThrow(RangeError);
  });
});

describe('provisional scores', () => {
  it('is provisional below 5 ranked books in the category', () => {
    expect(isProvisional(0)).toBe(true);
    expect(isProvisional(4)).toBe(true);
    expect(isProvisional(5)).toBe(false);
  });

  it('formats with a tilde when provisional', () => {
    expect(formatScore(8.5, true)).toBe('~8.5');
    expect(formatScore(10)).toBe('10.0');
  });
});
