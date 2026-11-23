import {
  BUCKETS,
  BUCKET_BANDS,
  formatScore,
  isProvisional,
  scoreForPosition,
  scoresForList,
} from '../scores';

describe('scoreForPosition', () => {
  it('gives a single book the top of its band', () => {
    expect(scoreForPosition('liked', 0, 1)).toBe(10);
    expect(scoreForPosition('fine', 0, 1)).toBe(6.6);
    expect(scoreForPosition('disliked', 0, 1)).toBe(3.3);
  });

  it('spans the whole band from best to worst', () => {
    expect(scoresForList('liked', 2)).toEqual([10, 6.7]);
    expect(scoresForList('liked', 4)).toEqual([10, 8.9, 7.8, 6.7]);
    expect(scoresForList('disliked', 3)).toEqual([3.3, 1.7, 0]);
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
    // 10 - (1/6) * 3.3 = 9.45 exactly; floating point would give 9.4499…
    expect(scoreForPosition('liked', 1, 7)).toBe(9.5);
    expect(scoreForPosition('liked', 2, 13)).toBe(9.5);
    expect(scoreForPosition('liked', 1, 23)).toBe(9.9);
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
