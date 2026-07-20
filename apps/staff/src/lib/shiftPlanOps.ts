import { nowIso } from './date';
import { deleteRow, insertRow, uuid } from './db';
import { addDays, dateRange } from './month';
import { db } from './powersync';
import type { ShiftPlanRow } from './powersync/schema';

// Rota (shift plan) writes. RLS restricts these to the owner; the UI gates the
// edit affordances the same way (§4 RLS↔UI table).

export async function addShiftPlan(input: {
  date: string;
  staffId: string;
  label: string | null;
  createdBy: string | null;
}): Promise<void> {
  await insertRow('shift_plan', {
    id: uuid(),
    date: input.date,
    staff_id: input.staffId,
    label: input.label?.trim() || null,
    created_by: input.createdBy,
    created_at: nowIso(),
  });
}

export async function removeShiftPlan(id: string): Promise<void> {
  await deleteRow('shift_plan', id);
}

// Assign one staff member to every day in [start, end], skipping days they are
// already on. Batched in one transaction — multi-row writes must commit together
// to be seen by the watched queries (the seed/writeTransaction law).
export async function addShiftPlanRange(input: {
  start: string;
  end: string;
  staffId: string;
  label: string | null;
  createdBy: string | null;
}): Promise<void> {
  const days = dateRange(input.start, input.end);
  if (days.length === 0) {
    return;
  }
  const existing = await db.getAll<{ date: string }>(
    'SELECT date FROM shift_plan WHERE staff_id = ? AND date >= ? AND date <= ?',
    [input.staffId, input.start, input.end],
  );
  const taken = new Set(existing.map((row) => row.date));
  const label = input.label?.trim() || null;
  const at = nowIso();
  await db.writeTransaction(async (tx) => {
    for (const date of days) {
      if (taken.has(date)) {
        continue;
      }
      await insertRow(
        'shift_plan',
        {
          id: uuid(),
          date,
          staff_id: input.staffId,
          label,
          created_by: input.createdBy,
          created_at: at,
        },
        tx,
      );
    }
  });
}

// Copy the 7 days ending the day before `anchor` onto the 7 days from `anchor`
// (shift +7), skipping (day, staff) assignments that already exist.
export async function copyPrevWeek(anchor: string, createdBy: string | null): Promise<number> {
  const source = await db.getAll<ShiftPlanRow>(
    'SELECT * FROM shift_plan WHERE date >= ? AND date <= ?',
    [addDays(anchor, -7), addDays(anchor, -1)],
  );
  if (source.length === 0) {
    return 0;
  }
  const existing = await db.getAll<{ date: string; staff_id: string }>(
    'SELECT date, staff_id FROM shift_plan WHERE date >= ? AND date <= ?',
    [anchor, addDays(anchor, 6)],
  );
  const taken = new Set(existing.map((row) => `${row.date}|${row.staff_id}`));
  const at = nowIso();
  let copied = 0;
  await db.writeTransaction(async (tx) => {
    for (const row of source) {
      if (!row.date || !row.staff_id) {
        continue;
      }
      const date = addDays(row.date, 7);
      const key = `${date}|${row.staff_id}`;
      if (taken.has(key)) {
        continue;
      }
      taken.add(key);
      copied++;
      await insertRow(
        'shift_plan',
        {
          id: uuid(),
          date,
          staff_id: row.staff_id,
          label: row.label ?? null,
          created_by: createdBy,
          created_at: at,
        },
        tx,
      );
    }
  });
  return copied;
}
