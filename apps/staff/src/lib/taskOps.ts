// R12: writes against the `task` table. Two kinds of row exist and the difference
// matters for every query on the cockpit:
//
//   当番に追加 (routine) → source='manual', group='daily', slot='first'|'second'
//   単発を追加  (one-off) → source='adhoc',  group='oneoff', slot=NULL
//
// The 0026 column GRANT allows authenticated writes to done/done_at/title/slot/sort
// only, so nothing here touches another column of an existing row. R14 keeps that
// grant as it is: `parent_id` is written once, on INSERT (0027 does not open it for
// UPDATE), so a subtask is never re-parented — it is deleted and typed again.

import { nowIso } from './date';
import { insertRow, updateRow, uuid } from './db';
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
  // Top-level rows only: a subtask has its own sort inside its parent (R14), and
  // letting a child's sort into this max would push new duty rows out of reach.
  const rows = await db.getAll<{ sort: number | null }>(
    'SELECT sort FROM task WHERE slot = ? AND "group" = ? AND parent_id IS NULL',
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
    parent_id: null,
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
    parent_id: null,
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

// R14: a subtask row, one level deep. slot/group are COPIED from the parent so the
// child follows its parent's duty (and the daily reset, which keys off `group`).
// The first child also clears the parent's stored done in the SAME transaction: a 1
// saved before the task was split would otherwise come back as a struck-through
// parent the moment the children are all ticked… or, worse, survive as a stale value
// nobody can see or clear (children make `done` unreadable — see taskTree).
export async function addSubtask(parentId: string, title: string): Promise<void> {
  const trimmed = title.trim();
  if (!trimmed) {
    return;
  }
  const parent = await db.getOptional<{ slot: string | null; group: string | null }>(
    'SELECT slot, "group" FROM task WHERE id = ?',
    [parentId],
  );
  if (!parent) {
    return;
  }
  const siblings = await db.getAll<{ sort: number | null }>(
    'SELECT sort FROM task WHERE parent_id = ?',
    [parentId],
  );
  const isFirstChild = siblings.length === 0;
  await db.writeTransaction(async (tx) => {
    await insertRow(
      'task',
      {
        id: uuid(),
        title: trimmed,
        group: parent.group ?? 'daily',
        phase: null,
        slot: parent.slot,
        sort: nextSort(siblings.map((row) => row.sort)),
        source: 'manual',
        owner_id: null,
        parent_id: parentId,
        done: 0,
        done_at: null,
        created_at: nowIso(),
      },
      tx,
    );
    if (isFirstChild) {
      await tx.execute('UPDATE task SET done = 0, done_at = NULL WHERE id = ?', [parentId]);
    }
  });
}

// Delete a row AND its subtasks, in one transaction. The 0027 FK cascade is the
// server-side backstop only: the local SQLite mirror has no foreign keys, and the
// demo/e2e path runs with no server at all, so the client has to sweep its own
// children or they would linger as invisible orphans.
export async function removeTaskTree(id: string): Promise<void> {
  await db.writeTransaction(async (tx) => {
    await tx.execute('DELETE FROM task WHERE parent_id = ?', [id]);
    await tx.execute('DELETE FROM task WHERE id = ?', [id]);
  });
}

// Rewrite a whole duty's sort values in ONE transaction. Renumbering everything
// (rather than swapping the two rows involved) is idempotent and repairs legacy
// rows that all share sort 0 — see taskOrder.renumber.
// The `parent_id IS NULL` guard keeps this scoped to the duty's own rows: children
// are numbered inside their parent by reorderChildren and must not be renumbered
// from the duty's list (both lists start at 0, 10, 20 …).
export async function reorderSlot(slot: 'first' | 'second', orderedIds: string[]): Promise<void> {
  await db.writeTransaction(async (tx) => {
    for (const row of renumber(orderedIds)) {
      await tx.execute('UPDATE task SET sort = ? WHERE id = ? AND slot = ? AND parent_id IS NULL', [
        row.sort,
        row.id,
        slot,
      ]);
    }
  });
}

// R14: the same renumbering, one level down — the subtasks of one parent.
export async function reorderChildren(parentId: string, orderedIds: string[]): Promise<void> {
  await db.writeTransaction(async (tx) => {
    for (const row of renumber(orderedIds)) {
      await tx.execute('UPDATE task SET sort = ? WHERE id = ? AND parent_id = ?', [
        row.sort,
        row.id,
        parentId,
      ]);
    }
  });
}

// Which list a ↑ / ↓ moves a row inside: a duty (top level) or one parent's
// subtasks. R14 keeps the two apart so a child can never be reordered into its
// parent's list, or vice versa.
export type SiblingScope = { slot: 'first' | 'second' } | { parentId: string };

// ↑ / ↓ on one row. `rows` is the SIBLING list as currently displayed (the screen
// passes it straight from the tree), so the resulting order is exactly what the
// person sees move.
export async function moveTask(
  scope: SiblingScope,
  rows: Pick<TaskRow, 'id'>[],
  id: string,
  direction: 'up' | 'down',
): Promise<void> {
  const ids = rows.map((row) => row.id);
  const next = moved(ids, id, direction);
  if (next === ids) {
    return;
  }
  if ('parentId' in scope) {
    await reorderChildren(scope.parentId, next);
    return;
  }
  await reorderSlot(scope.slot, next);
}
