/**
 * Binary-insertion ranking session.
 *
 * A new book is placed into an existing ordered (best-first) list of books
 * from the same (category, bucket) by asking "Which did you like more?"
 * questions. Each answer halves the remaining range, so a list of n books needs
 * at most ceil(log2(n + 1)) questions.
 *
 * This module is pure: no I/O and no UI. The session is an immutable value.
 * Every `answer` returns a new session, which makes it easy to test, to undo
 * (keep the previous value), and to drive from React state.
 */

export type BookId = string;

export type Answer =
  /** The new book is better than the one shown. */
  | 'new'
  /** The book already in the list is better. */
  | 'existing'
  /** Too close to call: place the new book directly below the one shown. */
  | 'tie'
  /** Stop asking: place the new book where the search currently points. */
  | 'skip';

export interface Comparison {
  winner: BookId;
  loser: BookId;
}

export interface InsertionSession {
  readonly newBook: BookId;
  /** Existing books in the list, best first. */
  readonly list: readonly BookId[];
  /** The insertion index is somewhere in [low, high]. */
  readonly low: number;
  readonly high: number;
  /** Set once the position is decided. */
  readonly position: number | null;
  /** Decisive answers so far, to store as raw comparison data. */
  readonly comparisons: readonly Comparison[];
}

export function startInsertion(newBook: BookId, list: readonly BookId[]): InsertionSession {
  if (list.includes(newBook)) {
    throw new Error(`Book ${newBook} is already in this list`);
  }
  if (new Set(list).size !== list.length) {
    throw new Error('List contains duplicate books');
  }
  const session: InsertionSession = {
    newBook,
    list: [...list],
    low: 0,
    high: list.length,
    position: null,
    comparisons: [],
  };
  return settle(session);
}

export function isComplete(session: InsertionSession): boolean {
  return session.position !== null;
}

/** Index in `list` of the book to compare against next, or null when complete. */
export function nextComparisonIndex(session: InsertionSession): number | null {
  if (session.position !== null) return null;
  return Math.floor((session.low + session.high) / 2);
}

/** The book to compare against next, or null when complete. */
export function nextOpponent(session: InsertionSession): BookId | null {
  const i = nextComparisonIndex(session);
  return i === null ? null : session.list[i];
}

export function answer(session: InsertionSession, response: Answer): InsertionSession {
  const mid = nextComparisonIndex(session);
  if (mid === null) {
    throw new Error('Insertion session is already complete');
  }
  const opponent = session.list[mid];

  switch (response) {
    case 'new':
      return settle({
        ...session,
        high: mid,
        comparisons: [...session.comparisons, { winner: session.newBook, loser: opponent }],
      });
    case 'existing':
      return settle({
        ...session,
        low: mid + 1,
        comparisons: [...session.comparisons, { winner: opponent, loser: session.newBook }],
      });
    case 'tie':
      return { ...session, position: mid + 1 };
    case 'skip':
      return { ...session, position: mid };
  }
}

/** The final list, best first, with the new book inserted. */
export function resultList(session: InsertionSession): BookId[] {
  if (session.position === null) {
    throw new Error('Insertion session is not complete');
  }
  const out = [...session.list];
  out.splice(session.position, 0, session.newBook);
  return out;
}

/** Most questions a list of this length can need. */
export function maxQuestions(listLength: number): number {
  return Math.ceil(Math.log2(listLength + 1));
}

/**
 * Convenience for tests and server-side checks: run a whole session using a
 * function that answers each question.
 */
export function runInsertion(
  newBook: BookId,
  list: readonly BookId[],
  decide: (newBook: BookId, opponent: BookId) => Answer,
): { list: BookId[]; position: number; comparisons: Comparison[] } {
  let session = startInsertion(newBook, list);
  while (!isComplete(session)) {
    session = answer(session, decide(newBook, nextOpponent(session)!));
  }
  return {
    list: resultList(session),
    position: session.position!,
    comparisons: [...session.comparisons],
  };
}

function settle(session: InsertionSession): InsertionSession {
  return session.low >= session.high ? { ...session, position: session.low } : session;
}
