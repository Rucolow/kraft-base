// Month ('YYYY-MM') arithmetic and calendar-grid helpers, shared by the work-time
// month navigator and the guest calendar. Pure UTC math so results never drift by
// the host timezone (the app fixes real dates as 'YYYY-MM-DD' text anyway).

export function parseYm(ym: string): [number, number] {
  const parts = ym.split('-');
  return [Number(parts[0] ?? '0'), Number(parts[1] ?? '1')];
}

export function addMonth(ym: string, delta: number): string {
  const [y, m] = parseYm(ym);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function monthLabel(ym: string): string {
  const [y, m] = parseYm(ym);
  return `${y}年${m}月`;
}

// Every day of the month as 'YYYY-MM-DD'.
export function monthDays(ym: string): string[] {
  const [y, m] = parseYm(ym);
  // Day 0 of the next month is the last day of this one.
  const count = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return Array.from({ length: count }, (_, i) => `${ym}-${String(i + 1).padStart(2, '0')}`);
}

// Blank cells before day 1 for a Sunday-first grid (0=Sun … 6=Sat), matching the
// usual Japanese calendar layout.
export function monthLeadingBlanks(ym: string): number {
  const [y, m] = parseYm(ym);
  return new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
}
