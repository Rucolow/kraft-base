// Local-first impedance bridge for uploads.
//
// PowerSync stores everything in SQLite types: booleans live as integer 0/1 and
// array columns live as JSON text (see db.ts boolToInt/serializeList). Postgres,
// however, has real BOOLEAN and uuid[]/text[] columns, and PostgREST rejects a
// JSON-text string sent to an array column (and won't reliably coerce 0/1 to a
// boolean). Without converting on upload, those writes are rejected server-side
// and silently discarded by the connector, so local and server diverge.
//
// IMPORTANT: this map must stay in sync with the Postgres schema
// (apps/staff/supabase/migrations). When a BOOLEAN or array column is added,
// add it here too. serialize.test.ts pins the current set.

type Row = Record<string, unknown>;

// table -> columns that are BOOLEAN in Postgres but integer 0/1 locally.
export const BOOLEAN_COLUMNS: Record<string, readonly string[]> = {
  guest: ['whole_house'],
  guest_note: ['pinned'],
  task: ['done'],
  followup: ['requires_owner'],
  staff: ['is_device'],
};

// table -> columns that are uuid[]/text[] in Postgres but JSON text locally.
export const ARRAY_COLUMNS: Record<string, readonly string[]> = {
  guest_note: ['mentions', 'read_by'],
  content: ['photo_paths'],
};

function toBool(value: unknown): boolean {
  return value === 1 || value === '1' || value === true;
}

function toArray(value: unknown): unknown[] {
  if (Array.isArray(value)) {
    return value;
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

// Convert a row's local values to their Postgres representation for the given
// table. Only present, non-null values are converted (PATCH sends a subset of
// columns; nulls pass through). Unknown tables/columns are left untouched.
export function serializeForServer(table: string, data: Row): Row {
  const out: Row = { ...data };
  for (const col of BOOLEAN_COLUMNS[table] ?? []) {
    if (out[col] != null) {
      out[col] = toBool(out[col]);
    }
  }
  for (const col of ARRAY_COLUMNS[table] ?? []) {
    if (out[col] != null) {
      out[col] = toArray(out[col]);
    }
  }
  return out;
}
