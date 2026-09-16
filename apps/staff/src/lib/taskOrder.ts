// R12: pure ordering maths for the 先当番/後当番 lists. Kept out of taskOps.ts so
// the interesting part (what the ↑↓ buttons actually do) is testable without a
// database.

// Renumber a duty's rows from scratch: 0, 10, 20 … Rewriting every row rather
// than swapping two makes the operation idempotent — running it twice, or on a
// list seeded with duplicate/legacy sort values (every 0006-era row had sort 0),
// converges on the same numbering instead of drifting.
export function renumber(orderedIds: string[]): Array<{ id: string; sort: number }> {
  return orderedIds.map((id, index) => ({ id, sort: index * 10 }));
}

// The order after moving one row one step up or down. Out-of-range moves (the
// first row up, the last row down, an unknown id) return the list unchanged, so
// the caller can always write the result back without a special case.
export function moved(orderedIds: string[], id: string, direction: 'up' | 'down'): string[] {
  const from = orderedIds.indexOf(id);
  if (from < 0) {
    return orderedIds;
  }
  const to = direction === 'up' ? from - 1 : from + 1;
  if (to < 0 || to >= orderedIds.length) {
    return orderedIds;
  }
  const next = [...orderedIds];
  const a = next[from] as string;
  const b = next[to] as string;
  next[to] = a;
  next[from] = b;
  return next;
}

// Sort value for a row appended to the end of a duty: one step past the largest
// in use (10 if the duty is empty). Gaps left by a delete are not reused.
export function nextSort(existing: Array<number | null>): number {
  const max = existing.reduce<number>((acc, value) => Math.max(acc, value ?? 0), 0);
  return max + 10;
}
