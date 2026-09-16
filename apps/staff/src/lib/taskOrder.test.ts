import { describe, expect, it } from 'vitest';
import { moved, nextSort, renumber } from './taskOrder';

describe('renumber', () => {
  it('spreads the list 10 apart from 0', () => {
    expect(renumber(['a', 'b', 'c'])).toEqual([
      { id: 'a', sort: 0 },
      { id: 'b', sort: 10 },
      { id: 'c', sort: 20 },
    ]);
  });

  // Every pre-0026 row carried sort 0; renumbering must converge, not drift.
  it('is idempotent', () => {
    const once = renumber(['a', 'b', 'c']);
    const twice = renumber(once.map((row) => row.id));
    expect(twice).toEqual(once);
  });

  it('handles an empty duty', () => {
    expect(renumber([])).toEqual([]);
  });
});

describe('moved', () => {
  const ids = ['a', 'b', 'c'];

  it('moves a row down one step', () => {
    expect(moved(ids, 'a', 'down')).toEqual(['b', 'a', 'c']);
  });

  it('moves a row up one step', () => {
    expect(moved(ids, 'c', 'up')).toEqual(['a', 'c', 'b']);
  });

  it('keeps the list unchanged at the edges', () => {
    expect(moved(ids, 'a', 'up')).toEqual(ids);
    expect(moved(ids, 'c', 'down')).toEqual(ids);
  });

  it('keeps the list unchanged for an unknown id', () => {
    expect(moved(ids, 'zzz', 'down')).toEqual(ids);
  });

  it('round-trips down then up', () => {
    expect(moved(moved(ids, 'a', 'down'), 'a', 'up')).toEqual(ids);
  });
});

describe('nextSort', () => {
  it('appends one step past the largest sort', () => {
    expect(nextSort([10, 20, 30])).toBe(40);
  });

  it('starts at 10 for an empty duty', () => {
    expect(nextSort([])).toBe(10);
  });

  it('ignores null sorts (rows added before 0026)', () => {
    expect(nextSort([null, 20, null])).toBe(30);
  });
});
