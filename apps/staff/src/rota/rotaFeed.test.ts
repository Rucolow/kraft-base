import { describe, expect, it } from 'vitest';
import { decodeHidden, encodeHidden, parseFeed, toggleId, visibleEntries } from './rotaFeed';

const feed = parseFeed({
  staff: [
    { id: 'a', name: 'モーリー', accent: '#2D4A3E' },
    { id: 'b', name: 'ルッコロー', accent: null },
  ],
  shifts: [
    { date: '2026-09-01', staff_id: 'a', label: '遅番' },
    { date: '2026-09-01', staff_id: 'b', label: null },
    { date: '2026-09-02', staff_id: 'zzz', label: null },
  ],
});

describe('parseFeed', () => {
  it('accepts the jsonb shape and normalises nulls', () => {
    expect(feed.staff).toHaveLength(2);
    expect(feed.shifts).toHaveLength(3);
    expect(feed.staff[1]?.accent).toBeNull();
    expect(feed.shifts[1]?.label).toBeNull();
  });
  it('degrades to empty on garbage (older function, array, null)', () => {
    expect(parseFeed(null)).toEqual({ staff: [], shifts: [] });
    expect(parseFeed([{ date: 'x' }])).toEqual({ staff: [], shifts: [] });
    expect(parseFeed({ staff: 'no', shifts: [{ date: 1 }, null] })).toEqual({
      staff: [],
      shifts: [],
    });
  });
});

describe('visibleEntries', () => {
  it('shows everyone by default, joined to name/accent', () => {
    const all = visibleEntries(feed, new Set());
    expect(all.map((e) => e.name)).toEqual(['モーリー', 'ルッコロー', '？']);
    expect(all[0]?.accent).toBe('#2D4A3E');
  });
  it('drops the staff the viewer switched off', () => {
    const only = visibleEntries(feed, new Set(['a', 'zzz']));
    expect(only.map((e) => e.staff_id)).toEqual(['b']);
  });
});

describe('toggle + persistence', () => {
  it('toggles without mutating the input', () => {
    const base = new Set(['a']);
    const on = toggleId(base, 'b');
    expect([...on]).toEqual(['a', 'b']);
    expect([...toggleId(on, 'a')]).toEqual(['b']);
    expect([...base]).toEqual(['a']);
  });
  it('round-trips through localStorage text and ignores junk', () => {
    expect([...decodeHidden(encodeHidden(new Set(['a', 'b'])))]).toEqual(['a', 'b']);
    expect(decodeHidden(null).size).toBe(0);
    expect(decodeHidden('{oops').size).toBe(0);
    expect([...decodeHidden('["a", 3, null]')]).toEqual(['a']);
  });
});
