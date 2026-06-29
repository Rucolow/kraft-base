import { describe, expect, it } from 'vitest';
import { jstDate, jstHour, shiftBoundaryIso, shiftDate } from './date';

// JST = UTC+9. Helpers below build instants by their JST wall-clock for clarity.
const jst = (iso: string) => new Date(`${iso}+09:00`);

describe('jstDate / jstHour', () => {
  it('reports the Asia/Tokyo calendar date and hour regardless of host TZ', () => {
    expect(jstDate(jst('2026-06-27T12:00:00'))).toBe('2026-06-27');
    expect(jstDate(jst('2026-06-27T23:30:00'))).toBe('2026-06-27');
    // 00:00 JST is the next calendar day vs 23:59 the same day
    expect(jstDate(jst('2026-06-28T00:00:00'))).toBe('2026-06-28');
    expect(jstHour(jst('2026-06-27T12:00:00'))).toBe(12);
  });
});

describe('shiftDate — shift-day rolls at 04:00 JST', () => {
  it('daytime/evening belong to the same calendar date', () => {
    expect(shiftDate(jst('2026-06-27T12:00:00'))).toBe('2026-06-27');
    expect(shiftDate(jst('2026-06-27T23:30:00'))).toBe('2026-06-27');
  });

  it('04:00 exactly starts the new shift-day; 03:59 is still the previous one', () => {
    expect(shiftDate(jst('2026-06-27T04:00:00'))).toBe('2026-06-27');
    expect(shiftDate(jst('2026-06-27T03:59:00'))).toBe('2026-06-26');
  });

  it('after-midnight hours (00:00–03:59) belong to the previous shift-day', () => {
    expect(shiftDate(jst('2026-06-27T00:00:00'))).toBe('2026-06-26');
    expect(shiftDate(jst('2026-06-27T00:30:00'))).toBe('2026-06-26');
    expect(shiftDate(jst('2026-06-27T02:00:00'))).toBe('2026-06-26');
  });

  it('handles month boundaries after midnight', () => {
    expect(shiftDate(jst('2026-07-01T02:00:00'))).toBe('2026-06-30');
  });
});

describe('shiftBoundaryIso', () => {
  it('is the 04:00 JST start of the current shift-day', () => {
    // 12:00 JST on the 27th -> boundary is 04:00 JST on the 27th = 19:00 UTC on the 26th
    expect(shiftBoundaryIso(jst('2026-06-27T12:00:00'))).toBe('2026-06-26T19:00:00.000Z');
    // 00:30 JST on the 27th is still the 26th's shift -> boundary is 04:00 JST on the 26th
    expect(shiftBoundaryIso(jst('2026-06-27T00:30:00'))).toBe('2026-06-25T19:00:00.000Z');
  });

  it('regression: a shift started at 00:30 JST is NOT stale (the night-shift bug)', () => {
    const now = jst('2026-06-27T00:30:00');
    const startedAt = jst('2026-06-27T00:30:00').toISOString();
    const boundary = shiftBoundaryIso(now);
    // sessionIsStale is `startedAt < boundary`; the night shift must be >= boundary.
    expect(startedAt >= boundary).toBe(true);
  });
});
