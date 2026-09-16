// R13: pure helpers for the 現金出納 ledger. Amounts are whole yen integers;
// negative = 返品・返金 (a refund is the same axis as a purchase, so v1 needs no
// second row type).
//
// The calendar date (jstDate in date.ts) is what this ledger keys off — NOT the
// 04:00 shift-day the rest of the app uses — so the book matches the receipts.

export interface CashRow {
  amount_yen: number | null;
  paid_from: string | null;
}

// 'YYYY-MM-DD' → 'YYYY-MM'. Anything shorter comes back as-is.
export function monthKey(date: string): string {
  return date.slice(0, 7);
}

export function sumYen(rows: CashRow[]): number {
  return rows.reduce((total, row) => total + (row.amount_yen ?? 0), 0);
}

// 立替 = paid out of someone's own pocket, to be settled at month end. There is
// deliberately no "settled" flag (the settlement is a monthly routine, not a
// per-row workflow), so this is a plain sum of the month's personal rows.
export function sumPersonal(rows: CashRow[]): number {
  return sumYen(rows.filter((row) => row.paid_from === 'personal'));
}

// 「¥1,200」 / 「−¥1,200」. The minus is U+2212 (not a hyphen) so a refund reads
// as a number and not as a stray dash at small sizes.
export function formatYen(amount: number): string {
  const yen = `¥${Math.abs(Math.trunc(amount)).toLocaleString('en-US')}`;
  return amount < 0 ? `−${yen}` : yen;
}
