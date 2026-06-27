import { db } from './powersync';

export type SqlValue = string | number | null;

export function uuid(): string {
  return crypto.randomUUID();
}

export function boolToInt(value: boolean): number {
  return value ? 1 : 0;
}

export function intToBool(value: number | null): boolean {
  return value === 1;
}

export function parseList(value: string | null): string[] {
  if (!value) {
    return [];
  }
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? (parsed as string[]) : [];
  } catch {
    return [];
  }
}

export function serializeList(value: string[]): string {
  return JSON.stringify(value);
}

// Minimal write surface shared by the database and a write transaction, so seed
// inserts can run inside a single transaction (see ensureLocalSeed).
export interface Executor {
  execute(sql: string, parameters?: SqlValue[]): Promise<unknown>;
}

export async function insertRow(
  table: string,
  values: Record<string, SqlValue>,
  exec: Executor = db,
): Promise<void> {
  const columns = Object.keys(values);
  const placeholders = columns.map(() => '?').join(', ');
  const quoted = columns.map((column) => `"${column}"`).join(', ');
  await exec.execute(
    `INSERT INTO "${table}" (${quoted}) VALUES (${placeholders})`,
    Object.values(values),
  );
}

export async function updateRow(
  table: string,
  id: string,
  values: Record<string, SqlValue>,
): Promise<void> {
  const assignments = Object.keys(values)
    .map((column) => `"${column}" = ?`)
    .join(', ');
  await db.execute(`UPDATE "${table}" SET ${assignments} WHERE id = ?`, [
    ...Object.values(values),
    id,
  ]);
}

export async function deleteRow(table: string, id: string): Promise<void> {
  await db.execute(`DELETE FROM "${table}" WHERE id = ?`, [id]);
}
