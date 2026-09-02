// R9-b: pure helpers for the public shift page. Kept free of React/DOM so the
// roster filter (「自分の日だけ見たい」) and the feed parsing are unit-testable.

export interface RotaStaff {
  id: string;
  name: string;
  accent: string | null;
}

export interface RotaShift {
  date: string;
  staff_id: string;
  label: string | null;
}

export interface RotaFeed {
  staff: RotaStaff[];
  shifts: RotaShift[];
}

export interface RotaEntry extends RotaShift {
  name: string;
  accent: string | null;
}

// rota_feed returns jsonb {staff:[...], shifts:[...]}. Be tolerant of a
// missing/odd shape (an older function still deployed, an empty result) so
// the page degrades to "no shifts" instead of crashing.
export function parseFeed(raw: unknown): RotaFeed {
  const obj = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const staff = Array.isArray(obj.staff) ? obj.staff : [];
  const shifts = Array.isArray(obj.shifts) ? obj.shifts : [];
  return {
    staff: staff
      .filter((s): s is Record<string, unknown> => !!s && typeof s === 'object')
      .filter((s) => typeof s.id === 'string' && typeof s.name === 'string')
      .map((s) => ({
        id: s.id as string,
        name: s.name as string,
        accent: typeof s.accent === 'string' ? s.accent : null,
      })),
    shifts: shifts
      .filter((r): r is Record<string, unknown> => !!r && typeof r === 'object')
      .filter((r) => typeof r.date === 'string' && typeof r.staff_id === 'string')
      .map((r) => ({
        date: r.date as string,
        staff_id: r.staff_id as string,
        label: typeof r.label === 'string' ? r.label : null,
      })),
  };
}

// Join shifts to the roster and drop the staff the viewer switched off.
// A shift whose staff is not in the roster (should not happen: the server
// already excludes hidden rows) is still shown, unnamed, rather than dropped.
export function visibleEntries(feed: RotaFeed, hiddenIds: ReadonlySet<string>): RotaEntry[] {
  const byId = new Map(feed.staff.map((s) => [s.id, s]));
  const out: RotaEntry[] = [];
  for (const shift of feed.shifts) {
    if (hiddenIds.has(shift.staff_id)) {
      continue;
    }
    const staff = byId.get(shift.staff_id);
    out.push({ ...shift, name: staff?.name ?? '？', accent: staff?.accent ?? null });
  }
  return out;
}

export function toggleId(hiddenIds: ReadonlySet<string>, id: string): Set<string> {
  const next = new Set(hiddenIds);
  if (next.has(id)) {
    next.delete(id);
  } else {
    next.add(id);
  }
  return next;
}

// Persisted as a JSON array of staff ids; anything malformed → nothing hidden.
export function decodeHidden(raw: string | null): Set<string> {
  if (!raw) {
    return new Set();
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    return new Set(
      Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [],
    );
  } catch {
    return new Set();
  }
}

export function encodeHidden(hiddenIds: ReadonlySet<string>): string {
  return JSON.stringify([...hiddenIds]);
}
