import { describe, expect, it } from 'vitest';
import { addDays, addMonth, dateRange, monthDays, monthLabel, monthLeadingBlanks } from './month';

describe('addMonth / monthLabel', () => {
  it('adds and subtracts months with year rollover', () => {
    expect(addMonth('2026-07', 1)).toBe('2026-08');
    expect(addMonth('2026-12', 1)).toBe('2027-01');
    expect(addMonth('2026-01', -1)).toBe('2025-12');
    expect(addMonth('2026-07', 0)).toBe('2026-07');
  });
  it('labels a month in Japanese', () => {
    expect(monthLabel('2026-07')).toBe('2026年7月');
    expect(monthLabel('2026-12')).toBe('2026年12月');
  });
});

describe('monthDays', () => {
  it('lists every day, respecting month length', () => {
    expect(monthDays('2026-02')).toHaveLength(28); // 2026 is not a leap year
    expect(monthDays('2024-02')).toHaveLength(29); // 2024 is
    expect(monthDays('2026-04')).toHaveLength(30);
    const jul = monthDays('2026-07');
    expect(jul).toHaveLength(31);
    expect(jul[0]).toBe('2026-07-01');
    expect(jul[30]).toBe('2026-07-31');
  });
});

describe('monthLeadingBlanks (Sunday-first)', () => {
  it('counts blanks before day 1 by weekday', () => {
    // 2026-07-01 is a Wednesday → Sun,Mon,Tue = 3 blanks.
    expect(monthLeadingBlanks('2026-07')).toBe(3);
    // 2026-03-01 is a Sunday → 0 blanks.
    expect(monthLeadingBlanks('2026-03')).toBe(0);
  });
});

describe('addDays', () => {
  it('adds and subtracts days across month/year boundaries', () => {
    expect(addDays('2026-07-20', 1)).toBe('2026-07-21');
    expect(addDays('2026-07-31', 1)).toBe('2026-08-01');
    expect(addDays('2026-08-01', -1)).toBe('2026-07-31');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
    expect(addDays('2026-07-20', 7)).toBe('2026-07-27');
    expect(addDays('2026-07-20', -7)).toBe('2026-07-13');
  });
});

describe('dateRange', () => {
  it('is inclusive and ordered', () => {
    expect(dateRange('2026-07-20', '2026-07-22')).toEqual([
      '2026-07-20',
      '2026-07-21',
      '2026-07-22',
    ]);
    expect(dateRange('2026-07-20', '2026-07-20')).toEqual(['2026-07-20']);
  });
  it('is empty when end precedes start', () => {
    expect(dateRange('2026-07-22', '2026-07-20')).toEqual([]);
  });
});
