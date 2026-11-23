import { settleWithLimit } from '../hooks';

jest.mock('@/lib/library/backend', () => ({ useBackend: jest.fn() }));

it('runs at most N tasks at once and keeps results in order', async () => {
  let running = 0;
  let peak = 0;
  const results = await settleWithLimit([1, 2, 3, 4, 5, 6, 7], 3, async (n) => {
    running++;
    peak = Math.max(peak, running);
    await new Promise((r) => setTimeout(r, 5));
    running--;
    if (n === 4) throw new Error('nope');
    return n * 10;
  });
  expect(peak).toBe(3);
  expect(results.map((r) => (r.status === 'fulfilled' ? r.value : 'x'))).toEqual([10, 20, 30, 'x', 50, 60, 70]);
});
