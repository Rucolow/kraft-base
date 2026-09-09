import { nowIso } from './date';
import { insertRow, uuid } from './db';
import { db } from './powersync';
import { type UnavailableMap, unavailableByDay } from './shiftAvail';

// R11: 「入れない日」(shift_unavailable) writes. Everyone may write, but the UI
// only ever passes the CURRENT staff's id — identity comes from currentStaff, not
// from the auth row (the shared iPad signs in as the device account), the same
// trust model as shift_session. RLS mirrors that: org member for select/insert/
// delete, no update (§4 RLS↔UI table).

// Toggle one (date, staff) request. The table has no unique constraint (PowerSync
// upserts by PK), so an off-toggle deletes EVERY matching row — otherwise a
// duplicate written by two devices would survive the tap and look stuck on.
// One transaction so the watched queries see the whole change at once.
export async function toggleUnavailable(input: {
  date: string;
  staffId: string;
  createdBy: string | null;
}): Promise<boolean> {
  const existing = await db.getAll<{ id: string }>(
    'SELECT id FROM shift_unavailable WHERE date = ? AND staff_id = ?',
    [input.date, input.staffId],
  );
  await db.writeTransaction(async (tx) => {
    if (existing.length > 0) {
      for (const row of existing) {
        await tx.execute('DELETE FROM shift_unavailable WHERE id = ?', [row.id]);
      }
      return;
    }
    await insertRow(
      'shift_unavailable',
      {
        id: uuid(),
        date: input.date,
        staff_id: input.staffId,
        created_by: input.createdBy,
        created_at: nowIso(),
      },
      tx,
    );
  });
  return existing.length === 0;
}

// Requests inside an arbitrary window, read straight from the database. The
// screen's watched query is scoped to the displayed month, but a bulk rota tool
// can reach across a month boundary (a range, or the week after the 31st) — it
// must not silently forget a request that simply fell outside the grid.
export async function unavailableBetween(from: string, to: string): Promise<UnavailableMap> {
  const rows = await db.getAll<{ date: string; staff_id: string }>(
    'SELECT date, staff_id FROM shift_unavailable WHERE date >= ? AND date <= ?',
    [from, to],
  );
  return unavailableByDay(rows);
}
