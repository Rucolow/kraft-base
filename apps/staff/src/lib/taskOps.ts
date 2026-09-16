// R12: writes against the `task` table. Two kinds of row exist and the difference
// matters for every query on the cockpit:
//
//   当番に追加 (routine) → source='manual', group='daily', slot='first'|'second'
//   単発を追加  (one-off) → source='adhoc',  group='oneoff', slot=NULL
//
// The 0026 column GRANT allows authenticated writes to done/done_at/title/slot/sort
// only, so nothing here touches another column of an existing row.

import { nowIso } from './date';
import { deleteRow, insertRow, updateRow, uuid } from './db';
import { db } from './powersync';
import type { TaskRow } from './powersync/schema';
import { moved, nextSort, renumber } from './taskOrder';

// Routine task appended to the end of a duty. owner_id is deliberately left null:
// on `task` that column is the ASSIGNEE (@名前 badge), not an author field, and a
// daily duty task belongs to whoever is on duty, not to the person who typed it.
export async function addRoutineTask(slot: 'first' | 'second', title: string): Promise<void> {
  const trimmed = title.trim();
  if (!trimmed) {
    return;
  }
  const rows = await db.getAll<{ sort: number | null }>(
    'SELECT sort FROM task WHERE slot = ? AND "group" = ?',
    [slot, 'daily'],
  );
  await insertRow('task', {
    id: uuid(),
    title: trimmed,
    group: 'daily',
    phase: null,
    slot,
    sort: nextSort(rows.map((row) => row.sort)),
    source: 'manual',
    owner_id: null,
    done: 0,
    done_at: null,
    created_at: nowIso(),
  });
}

// One-off task ("noticed it, make it a task"), unchanged from before R12.
export async function addTask(title: string): Promise<void> {
  const trimmed = title.trim();
  if (!trimmed) {
    return;
  }
  await insertRow('task', {
    id: uuid(),
    title: trimmed,
    group: 'oneoff',
    phase: null,
    slot: null,
    sort: 0,
    source: 'adhoc',
    owner_id: null,
    done: 0,
    done_at: null,
    created_at: nowIso(),
  });
}

export async function renameTask(id: string, title: string): Promise<void> {
  const trimmed = title.trim();
  if (!trimmed) {
    return;
  }
  await updateRow('task', id, { title: trimmed });
}

export async function removeTask(id: string): Promise<void> {
  await deleteRow('task', id);
}

// Rewrite a whole duty's sort values in ONE transaction. Renumbering everything
// (rather than swapping the two rows involved) is idempotent and repairs legacy
// rows that all share sort 0 — see taskOrder.renumber.
export async function reorderSlot(slot: 'first' | 'second', orderedIds: string[]): Promise<void> {
  await db.writeTransaction(async (tx) => {
    for (const row of renumber(orderedIds)) {
      await tx.execute('UPDATE task SET sort = ? WHERE id = ? AND slot = ?', [
        row.sort,
        row.id,
        slot,
      ]);
    }
  });
}

// ↑ / ↓ on one row of a duty. `rows` is the duty as currently displayed, so the
// resulting order is exactly what the person sees move.
export async function moveTask(
  slot: 'first' | 'second',
  rows: Pick<TaskRow, 'id'>[],
  id: string,
  direction: 'up' | 'down',
): Promise<void> {
  const ids = rows.map((row) => row.id);
  const next = moved(ids, id, direction);
  if (next === ids) {
    return;
  }
  await reorderSlot(slot, next);
}
