// R14: 定型タスクの 1 段の親子（サブタスク）を、DB を触らずに扱える純関数。
// 画面（本日／タスク）はこのモジュールが返すツリーだけを読む。
//
// 設計の要:
//   - 親の done は **保存しない**。読み取り時に子から導出する（effectiveDone）。
//     書き戻し（syncParentDone のようなもの）を作らないので、二端末の同時操作や
//     オフラインの順序で「矛盾した 1」が固定されることがない。
//   - 同期の隙間（親だけ先に消えた／子だけ先に届いた）でもタスクが画面から
//     消えないよう、親の見つからない子・孫は **orphan として親の位置に出す**。

import type { TaskRow } from './powersync/schema';

export interface TaskNode {
  task: TaskRow;
  children: TaskRow[];
}

function isDone(task: Pick<TaskRow, 'done'>): boolean {
  return task.done === 1;
}

// 兄弟の並び。sort が同値（レガシー行は全部 0）でも順番がぶれないよう
// created_at → id まで見る。クエリ側の ORDER BY には依存しない。
function compareSiblings(a: TaskRow, b: TaskRow): number {
  const sort = (a.sort ?? 0) - (b.sort ?? 0);
  if (sort !== 0) {
    return sort;
  }
  const created = (a.created_at ?? '').localeCompare(b.created_at ?? '');
  if (created !== 0) {
    return created;
  }
  return a.id.localeCompare(b.id);
}

// 行の配列 → 1 段のツリー。親の並びは渡された順（＝クエリの ORDER BY）のまま、
// 子だけをこのモジュールが並べ替える。
export function buildTree(rows: TaskRow[]): TaskNode[] {
  const byId = new Map(rows.map((row) => [row.id, row]));
  const childrenOf = new Map<string, TaskRow[]>();
  const tops: TaskRow[] = [];

  for (const row of rows) {
    const parent = row.parent_id ? byId.get(row.parent_id) : undefined;
    // 親が居ない（同期の隙間）／親自身が子（＝孫）／自己参照 は全て親扱いで表示する。
    if (!parent || parent.id === row.id || parent.parent_id) {
      tops.push(row);
      continue;
    }
    const siblings = childrenOf.get(parent.id);
    if (siblings) {
      siblings.push(row);
    } else {
      childrenOf.set(parent.id, [row]);
    }
  }

  return tops.map((task) => ({
    task,
    children: [...(childrenOf.get(task.id) ?? [])].sort(compareSiblings),
  }));
}

// 子を持つ親の完了。空配列の every は true になるので、children.length > 0 が必須。
export function isParentDone(children: Array<Pick<TaskRow, 'done'>>): boolean {
  return children.length > 0 && children.every(isDone);
}

// 画面に出す完了状態。子を持つ親は自分の done 列を読まない（導出が正）。
export function effectiveDone(node: TaskNode): boolean {
  return node.children.length > 0 ? isParentDone(node.children) : isDone(node.task);
}

// 親行のバッジ「2/3」。
export function parentProgress(node: TaskNode): { done: number; total: number } {
  return {
    done: node.children.filter(isDone).length,
    total: node.children.length,
  };
}

// 本日カードの「done / total」。子を持つ親は 1 件として数えず、葉（子・子なしの親）
// だけを数える。親と子を二重に数えると「3/2」のようなカウンタになる。
export function countLeaves(nodes: TaskNode[]): { done: number; total: number } {
  let done = 0;
  let total = 0;
  for (const node of nodes) {
    const leaves = node.children.length > 0 ? node.children : [node.task];
    total += leaves.length;
    done += leaves.filter(isDone).length;
  }
  return { done, total };
}
