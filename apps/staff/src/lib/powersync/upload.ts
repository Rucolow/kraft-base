// Turns one PowerSync CRUD op into one PostgREST statement.
//
// A PUT is sent as a plain INSERT — never as `upsert()`. supabase-js `upsert()`
// sends `Prefer: resolution=merge-duplicates`, which PostgREST compiles into
// `INSERT ... ON CONFLICT (id) DO UPDATE SET <every column in the payload>`.
// PostgreSQL checks the UPDATE privilege of every SET column when the statement
// is planned, whether or not a row actually conflicts, so on a table where
// `authenticated` has no UPDATE grant (or only a column-restricted one) every
// insert is rejected with 42501:
//   - task: migration 0006 revokes UPDATE and re-grants only (done, done_at)
//     → ad-hoc task creation was rejected in production.
//   - shift_unavailable: migration 0025 grants select/insert/delete only
//     → 休み希望 registration was rejected in production.
// The connector discards 42xxx ops (a rejected write must not wedge sync), so
// the row appeared locally and then silently vanished on the next re-login.
// A plain INSERT needs only the INSERT privilege, so it goes through.
//
// If the row already exists server-side the INSERT comes back as 23505
// (rare: a PUT re-issued after a local wipe/reseed). Only then do we fall back
// to an UPDATE, which preserves the intent wherever the grants allow it.
import { serializeForServer } from './serialize';

export interface PgError {
  code?: string | null;
  message?: string | null;
}

export interface UploadResult {
  error: PgError | null;
}

interface EqBuilder {
  eq(column: string, value: string): PromiseLike<UploadResult>;
}

interface TableBuilder {
  insert(values: object): PromiseLike<UploadResult>;
  update(values: object): EqBuilder;
  delete(): EqBuilder;
}

// Structural subset of the supabase-js client used by the upload path, so the
// unit test can drive it with a fake that records calls.
export interface UploadClient {
  from(table: string): TableBuilder;
}

export interface UploadOp {
  op: 'PUT' | 'PATCH' | 'DELETE';
  table: string;
  id: string;
  opData?: Record<string, unknown>;
}

export async function uploadOp(client: UploadClient, op: UploadOp): Promise<UploadResult> {
  // Convert local SQLite representation (int booleans, JSON-text arrays) to the
  // Postgres column types, otherwise PostgREST rejects array/boolean writes and
  // they get silently discarded by the connector.
  const data = serializeForServer(op.table, op.opData ?? {});

  if (op.op === 'DELETE') {
    return await client.from(op.table).delete().eq('id', op.id);
  }
  if (op.op === 'PATCH') {
    return await client.from(op.table).update(data).eq('id', op.id);
  }

  const inserted = await client.from(op.table).insert({ ...data, id: op.id });
  if (inserted.error?.code === '23505') {
    return await client.from(op.table).update(data).eq('id', op.id);
  }
  return inserted;
}
