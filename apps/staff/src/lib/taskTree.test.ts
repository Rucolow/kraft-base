import { describe, expect, it } from 'vitest';
import type { TaskRow } from './powersync/schema';
import { buildTree, countLeaves, effectiveDone, isParentDone, parentProgress } from './taskTree';

function task(row: Partial<TaskRow> & { id: string }): TaskRow {
  return {
    id: row.id,
    title: row.title ?? row.id,
    group: row.group ?? 'daily',
    phase: null,
    slot: row.slot ?? 'first',
    sort: row.sort ?? 0,
    source: row.source ?? 'manual',
    owner_id: null,
    parent_id: row.parent_id ?? null,
    done: row.done ?? 0,
    done_at: row.done_at ?? null,
    created_at: row.created_at ?? '2026-09-16T00:00:00.000Z',
  } as TaskRow;
}

describe('buildTree', () => {
  it('nests children under their parent', () => {
    const tree = buildTree([
      task({ id: 'p', sort: 10 }),
      task({ id: 'c1', parent_id: 'p', sort: 10 }),
      task({ id: 'c2', parent_id: 'p', sort: 20 }),
      task({ id: 'q', sort: 20 }),
    ]);
    expect(tree.map((node) => node.task.id)).toEqual(['p', 'q']);
    expect(tree[0]?.children.map((child) => child.id)).toEqual(['c1', 'c2']);
    expect(tree[1]?.children).toEqual([]);
  });

  // The query orders every row by sort, so a child can arrive BEFORE its parent.
  // Children are ordered inside their parent, not by their position in the input.
  it('does not depend on the query order (child sort smaller than the parent)', () => {
    const tree = buildTree([
      task({ id: 'c2', parent_id: 'p', sort: 20 }),
      task({ id: 'c1', parent_id: 'p', sort: 10 }),
      task({ id: 'p', sort: 70 }),
    ]);
    expect(tree.map((node) => node.task.id)).toEqual(['p']);
    expect(tree[0]?.children.map((child) => child.id)).toEqual(['c1', 'c2']);
  });

  it('orders siblings with equal sort by created_at then id', () => {
    const tree = buildTree([
      task({ id: 'p' }),
      task({ id: 'b', parent_id: 'p', created_at: '2026-09-16T00:00:02.000Z' }),
      task({ id: 'a', parent_id: 'p', created_at: '2026-09-16T00:00:01.000Z' }),
      task({ id: 'z', parent_id: 'p', created_at: '2026-09-16T00:00:01.000Z' }),
    ]);
    expect(tree[0]?.children.map((child) => child.id)).toEqual(['a', 'z', 'b']);
  });

  // Sync gap: the parent row hasn't arrived (or was deleted elsewhere). The child
  // must stay visible instead of disappearing from the checklist.
  it('promotes an orphan to the top level', () => {
    const tree = buildTree([task({ id: 'p' }), task({ id: 'lost', parent_id: 'gone' })]);
    expect(tree.map((node) => node.task.id)).toEqual(['p', 'lost']);
    expect(tree[1]?.children).toEqual([]);
  });

  // The UI never creates one, but a hand-written row could: a grandchild is shown
  // as its own top-level row rather than silently dropped.
  it('treats a grandchild as an orphan', () => {
    const tree = buildTree([
      task({ id: 'p' }),
      task({ id: 'c', parent_id: 'p' }),
      task({ id: 'g', parent_id: 'c' }),
    ]);
    expect(tree.map((node) => node.task.id)).toEqual(['p', 'g']);
    expect(tree[0]?.children.map((child) => child.id)).toEqual(['c']);
    expect(tree[1]?.children).toEqual([]);
  });

  it('keeps a self-referencing row at the top level', () => {
    const tree = buildTree([task({ id: 'p', parent_id: 'p' })]);
    expect(tree.map((node) => node.task.id)).toEqual(['p']);
    expect(tree[0]?.children).toEqual([]);
  });

  it('handles an empty list', () => {
    expect(buildTree([])).toEqual([]);
  });
});

describe('isParentDone', () => {
  it('is false with no children (the empty every() trap)', () => {
    expect(isParentDone([])).toBe(false);
  });

  it('is true only when every child is done', () => {
    expect(isParentDone([task({ id: 'a', done: 1 }), task({ id: 'b', done: 1 })])).toBe(true);
    expect(isParentDone([task({ id: 'a', done: 1 }), task({ id: 'b', done: 0 })])).toBe(false);
  });
});

describe('effectiveDone', () => {
  it('derives a parent from its children, ignoring the stored done', () => {
    const parent = task({ id: 'p', done: 1 });
    const node = { task: parent, children: [task({ id: 'c', parent_id: 'p', done: 0 })] };
    expect(effectiveDone(node)).toBe(false);
    const allDone = { task: parent, children: [task({ id: 'c', parent_id: 'p', done: 1 })] };
    expect(effectiveDone(allDone)).toBe(true);
  });

  // A parent whose children were all deleted is an ordinary task again.
  it('reads the row itself when there are no children', () => {
    expect(effectiveDone({ task: task({ id: 'p', done: 1 }), children: [] })).toBe(true);
    expect(effectiveDone({ task: task({ id: 'p', done: 0 }), children: [] })).toBe(false);
  });
});

describe('parentProgress', () => {
  it('counts done children', () => {
    const node = {
      task: task({ id: 'p' }),
      children: [
        task({ id: 'a', parent_id: 'p', done: 1 }),
        task({ id: 'b', parent_id: 'p', done: 0 }),
        task({ id: 'c', parent_id: 'p', done: 0 }),
      ],
    };
    expect(parentProgress(node)).toEqual({ done: 1, total: 3 });
  });

  it('is 0/0 for a childless row', () => {
    expect(parentProgress({ task: task({ id: 'p' }), children: [] })).toEqual({
      done: 0,
      total: 0,
    });
  });
});

describe('countLeaves', () => {
  // The card counter must not count a parent AND its children — a 2-child parent
  // contributes 2, not 3.
  it('counts leaves only, never the parent of a subtree', () => {
    const tree = buildTree([
      task({ id: 'p', done: 1 }),
      task({ id: 'c1', parent_id: 'p', done: 1 }),
      task({ id: 'c2', parent_id: 'p', done: 0 }),
      task({ id: 'leaf', done: 1 }),
    ]);
    expect(countLeaves(tree)).toEqual({ done: 2, total: 3 });
  });

  it('counts a childless parent as one leaf', () => {
    expect(countLeaves(buildTree([task({ id: 'p', done: 0 })]))).toEqual({ done: 0, total: 1 });
  });

  it('is 0/0 for an empty duty', () => {
    expect(countLeaves([])).toEqual({ done: 0, total: 0 });
  });
});
