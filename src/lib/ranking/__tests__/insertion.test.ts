import {
  answer,
  isComplete,
  maxQuestions,
  nextOpponent,
  resultList,
  runInsertion,
  startInsertion,
  type Answer,
} from '../insertion';

/** Answers questions as a reader whose true preference order is `truth` (best first). */
function oracle(truth: string[]) {
  return (newBook: string, opponent: string): Answer =>
    truth.indexOf(newBook) < truth.indexOf(opponent) ? 'new' : 'existing';
}

describe('startInsertion', () => {
  it('needs no questions for an empty list', () => {
    const s = startInsertion('a', []);
    expect(isComplete(s)).toBe(true);
    expect(resultList(s)).toEqual(['a']);
  });

  it('rejects a book that is already in the list', () => {
    expect(() => startInsertion('a', ['a', 'b'])).toThrow(/already in this list/);
  });

  it('rejects a list with duplicates', () => {
    expect(() => startInsertion('x', ['a', 'a'])).toThrow(/duplicate/);
  });
});

describe('binary insertion', () => {
  it('places the book at the correct position for every list size and every true position', () => {
    for (let n = 0; n <= 40; n++) {
      for (let truePos = 0; truePos <= n; truePos++) {
        const existing = Array.from({ length: n }, (_, i) => `b${i}`);
        const truth = [...existing];
        truth.splice(truePos, 0, 'new');

        let questions = 0;
        const decide = oracle(truth);
        const result = runInsertion('new', existing, (nb, opp) => {
          questions++;
          return decide(nb, opp);
        });

        expect(result.position).toBe(truePos);
        expect(result.list).toEqual(truth);
        expect(questions).toBeLessThanOrEqual(maxQuestions(n));
        expect(result.comparisons).toHaveLength(questions);
      }
    }
  });

  it('records winner and loser for every decisive answer', () => {
    // Truth: a > new > b > c
    const result = runInsertion('new', ['a', 'b', 'c'], oracle(['a', 'new', 'b', 'c']));
    expect(result.list).toEqual(['a', 'new', 'b', 'c']);
    for (const c of result.comparisons) {
      expect([c.winner, c.loser]).toContain('new');
    }
    expect(result.comparisons).toContainEqual({ winner: 'new', loser: 'b' });
    expect(result.comparisons).toContainEqual({ winner: 'a', loser: 'new' });
  });

  it('needs about 6 questions for a 64-book list', () => {
    expect(maxQuestions(63)).toBe(6);
    expect(maxQuestions(64)).toBe(7);
  });

  it('does not mutate the input list or earlier sessions', () => {
    const list = ['a', 'b', 'c'];
    const s0 = startInsertion('new', list);
    const s1 = answer(s0, 'new');
    expect(list).toEqual(['a', 'b', 'c']);
    expect(s0.comparisons).toHaveLength(0);
    expect(s0.high).toBe(3);
    expect(s1.comparisons).toHaveLength(1);
  });
});

describe('tie and skip', () => {
  it('"tie" places the book directly below the book shown, without recording a comparison', () => {
    let s = startInsertion('new', ['a', 'b', 'c', 'd', 'e']);
    expect(nextOpponent(s)).toBe('c');
    s = answer(s, 'tie');
    expect(isComplete(s)).toBe(true);
    expect(resultList(s)).toEqual(['a', 'b', 'c', 'new', 'd', 'e']);
    expect(s.comparisons).toHaveLength(0);
  });

  it('"skip" places the book where the search points and keeps earlier answers', () => {
    let s = startInsertion('new', ['a', 'b', 'c', 'd', 'e', 'f', 'g']);
    expect(nextOpponent(s)).toBe('d');
    s = answer(s, 'existing'); // range is now e..g
    expect(nextOpponent(s)).toBe('f');
    s = answer(s, 'skip');
    expect(resultList(s)).toEqual(['a', 'b', 'c', 'd', 'e', 'new', 'f', 'g']);
    expect(s.comparisons).toEqual([{ winner: 'd', loser: 'new' }]);
  });

  it('throws when answering a completed session', () => {
    const s = answer(startInsertion('new', ['a']), 'new');
    expect(isComplete(s)).toBe(true);
    expect(() => answer(s, 'new')).toThrow(/already complete/);
  });

  it('throws when reading the result of an incomplete session', () => {
    expect(() => resultList(startInsertion('new', ['a']))).toThrow(/not complete/);
  });
});
