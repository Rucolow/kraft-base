// R11: pure helpers over the 「入れない日」(shift_unavailable) rows. The table has
// no unique constraint (PowerSync upserts by PK), so every reader must dedupe
// (date, staff) itself — that is what `unavailableByDay` is for.

export interface UnavailableLike {
  date: string | null;
  staff_id: string | null;
}

export type UnavailableMap = Map<string, string[]>;

// date -> staff ids that cannot work that day (deduped, insertion order kept so
// the UI can re-sort by the roster).
export function unavailableByDay(rows: UnavailableLike[]): UnavailableMap {
  const map: UnavailableMap = new Map();
  for (const row of rows) {
    if (!row.date || !row.staff_id) {
      continue;
    }
    const ids = map.get(row.date);
    if (!ids) {
      map.set(row.date, [row.staff_id]);
    } else if (!ids.includes(row.staff_id)) {
      ids.push(row.staff_id);
    }
  }
  return map;
}

export function isUnavailable(map: UnavailableMap, date: string, staffId: string | null): boolean {
  if (!staffId) {
    return false;
  }
  return map.get(date)?.includes(staffId) ?? false;
}

// Split candidate days for ONE staff member into the ones to assign and the ones
// to leave alone. The bulk tools (期間まとめ / 前週コピー) use this so a request
// is never silently overwritten — the caller lists `skipped` in its confirm.
export function splitByAvailability(
  dates: string[],
  staffId: string | null,
  map: UnavailableMap,
): { assign: string[]; skipped: string[] } {
  const assign: string[] = [];
  const skipped: string[] = [];
  for (const date of dates) {
    if (isUnavailable(map, date, staffId)) {
      skipped.push(date);
    } else {
      assign.push(date);
    }
  }
  return { assign, skipped };
}
