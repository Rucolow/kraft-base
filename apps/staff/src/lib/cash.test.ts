import { describe, expect, it } from 'vitest';
import { type CashRow, formatYen, monthKey, sumPersonal, sumYen } from './cash';

const row = (amount_yen: number | null, paid_from = 'house'): CashRow => ({
  amount_yen,
  paid_from,
});

describe('monthKey', () => {
  it('takes the calendar month of a date', () => {
    expect(monthKey('2026-09-16')).toBe('2026-09');
  });

  it('leaves a month string alone', () => {
    expect(monthKey('2026-09')).toBe('2026-09');
  });
});

describe('sumYen', () => {
  it('adds the month up', () => {
    expect(sumYen([row(1200), row(800)])).toBe(2000);
  });

  // 返品・返金 are negative rows, so they must pull the total DOWN.
  it('subtracts refunds', () => {
    expect(sumYen([row(1200), row(-500)])).toBe(700);
  });

  it('treats a missing amount as zero', () => {
    expect(sumYen([row(null), row(300)])).toBe(300);
  });

  it('is zero for an empty month', () => {
    expect(sumYen([])).toBe(0);
  });
});

describe('sumPersonal', () => {
  it('counts only the 立替 rows', () => {
    expect(sumPersonal([row(1200, 'personal'), row(800, 'house'), row(300, 'personal')])).toBe(
      1500,
    );
  });

  it('is zero when nothing was paid personally', () => {
    expect(sumPersonal([row(1200), row(800)])).toBe(0);
  });
});

describe('formatYen', () => {
  it('groups thousands', () => {
    expect(formatYen(1200)).toBe('¥1,200');
    expect(formatYen(1234567)).toBe('¥1,234,567');
  });

  it('renders a refund with a real minus sign', () => {
    expect(formatYen(-1200)).toBe('−¥1,200');
  });

  it('renders zero without a sign', () => {
    expect(formatYen(0)).toBe('¥0');
  });
});
