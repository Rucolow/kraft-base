import { describe, expect, it } from 'vitest';
import { isUnavailable, splitByAvailability, unavailableByDay } from './shiftAvail';

const row = (date: string | null, staff: string | null) => ({ date, staff_id: staff });

describe('unavailableByDay', () => {
  it('groups by day and dedupes the same staff twice on one day', () => {
    const map = unavailableByDay([
      row('2026-09-12', 'a'),
      row('2026-09-12', 'a'),
      row('2026-09-12', 'b'),
      row('2026-09-13', 'a'),
    ]);
    expect(map.get('2026-09-12')).toEqual(['a', 'b']);
    expect(map.get('2026-09-13')).toEqual(['a']);
    expect(map.size).toBe(2);
  });

  it('ignores rows with a missing date or staff', () => {
    const map = unavailableByDay([row(null, 'a'), row('2026-09-12', null), row('', 'a')]);
    expect(map.size).toBe(0);
  });
});

describe('isUnavailable', () => {
  const map = unavailableByDay([row('2026-09-12', 'a')]);
  it('reports a registered day for that staff only', () => {
    expect(isUnavailable(map, '2026-09-12', 'a')).toBe(true);
    expect(isUnavailable(map, '2026-09-12', 'b')).toBe(false);
    expect(isUnavailable(map, '2026-09-13', 'a')).toBe(false);
  });
  it('is false without a staff id (no current staff on the device)', () => {
    expect(isUnavailable(map, '2026-09-12', null)).toBe(false);
  });
});

describe('splitByAvailability', () => {
  const map = unavailableByDay([
    row('2026-09-12', 'a'),
    row('2026-09-13', 'a'),
    row('2026-09-14', 'b'),
  ]);
  it('keeps order and separates the days the staff cannot work', () => {
    const dates = ['2026-09-11', '2026-09-12', '2026-09-13', '2026-09-14'];
    expect(splitByAvailability(dates, 'a', map)).toEqual({
      assign: ['2026-09-11', '2026-09-14'],
      skipped: ['2026-09-12', '2026-09-13'],
    });
  });
  it('skips nothing for a staff with no requests', () => {
    expect(splitByAvailability(['2026-09-12'], 'c', map)).toEqual({
      assign: ['2026-09-12'],
      skipped: [],
    });
  });
  it('handles an empty range', () => {
    expect(splitByAvailability([], 'a', map)).toEqual({ assign: [], skipped: [] });
  });
});
