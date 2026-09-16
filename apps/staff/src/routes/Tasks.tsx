import { ArrowDown, ArrowUp, Check, ChevronDown, ChevronRight, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Badge, Card, EmptyState, Screen, SectionLabel } from '../components/ui';
import { useTasks } from '../data/queries';
import { intToBool } from '../lib/db';
import type { TaskRow } from '../lib/powersync/schema';
import { useSession } from '../lib/session';
import { setTaskDone } from '../lib/shiftOps';
import {
  type SiblingScope,
  addRoutineTask,
  addSubtask,
  addTask,
  moveTask,
  removeTaskTree,
  renameTask,
} from '../lib/taskOps';
import { type TaskNode, buildTree, effectiveDone, parentProgress } from '../lib/taskTree';

// R12: the two duties, in the order they run. 単発 (one-offs) is rendered AFTER
// both of them and that order is load-bearing for the e2e suites, which delete
// 「the last delete button」 expecting the one-off they just added.
const SLOTS = [
  { key: 'first', label: '先当番' },
  { key: 'second', label: '後当番' },
] as const;

type SlotKey = (typeof SLOTS)[number]['key'];

// What ↑/↓ act on: the list of siblings as displayed, and the scope those ids
// belong to (a duty, or one parent's subtasks — R14 keeps the two apart).
type RowControls = { scope: SiblingScope; rows: TaskRow[] };

// Rename field for one routine row. Local state (seeded from the row and keyed on
// its id) so typing isn't fought by the watched query re-rendering mid-edit; the
// write happens on blur or Enter.
function RenameField({ task }: { task: TaskRow }) {
  const [value, setValue] = useState(task.title ?? '');
  const commit = () => {
    if (value.trim() && value.trim() !== (task.title ?? '')) {
      renameTask(task.id, value);
    }
  };
  return (
    <input
      aria-label="タスク名"
      className="min-h-[36px] flex-1 rounded-[9px] border border-line bg-cream px-2 py-1.5 text-[0.9rem] outline-none focus:border-orange-light"
      value={value}
      onChange={(event) => setValue(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.currentTarget.blur();
        }
      }}
    />
  );
}

export function Tasks() {
  const { staff, isOwner } = useSession();
  const { data: tasks } = useTasks();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [slotDraft, setSlotDraft] = useState<Record<string, string>>({});
  // R14: one draft per parent (the サブタスクを追加 field) and which parents are
  // open. While 編集 is on, every parent is expanded regardless of this map.
  const [subDraft, setSubDraft] = useState<Record<string, string>>({});
  const [openParents, setOpenParents] = useState<Record<string, boolean>>({});

  // Deletion is owner-only — matches the task_delete RLS policy (is_owner). A
  // confirm guards against removing a recurring task by mistake. It stays outside
  // the 編集 toggle so the delete affordance is exactly where it has always been.
  // R14: deleting a parent takes its subtasks with it (removeTaskTree).
  async function confirmRemove(task: TaskRow, childCount = 0) {
    const label =
      childCount > 0
        ? `「${task.title}」とサブタスク${childCount}件を削除しますか？`
        : `「${task.title}」を削除しますか？`;
    if (!window.confirm(label)) {
      return;
    }
    await removeTaskTree(task.id);
  }

  async function addOneoff() {
    if (!draft.trim()) {
      return;
    }
    await addTask(draft);
    setDraft('');
  }

  async function addToSlot(slot: SlotKey) {
    const value = slotDraft[slot] ?? '';
    if (!value.trim()) {
      return;
    }
    await addRoutineTask(slot, value);
    setSlotDraft((prev) => ({ ...prev, [slot]: '' }));
  }

  async function addChild(parentId: string) {
    const value = subDraft[parentId] ?? '';
    if (!value.trim()) {
      return;
    }
    await addSubtask(parentId, value);
    setSubDraft((prev) => ({ ...prev, [parentId]: '' }));
  }

  function deleteButton(task: TaskRow, childCount = 0) {
    if (!isOwner) {
      return null;
    }
    return (
      <button
        type="button"
        aria-label="タスクを削除"
        onClick={() => confirmRemove(task, childCount)}
        className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-ink-mute"
      >
        <Trash2 size={15} />
      </button>
    );
  }

  // One tickable row. Borders live on the wrapper (a parent and its subtasks are
  // one block), so this renders the row's contents only.
  function row(task: TaskRow, controls: RowControls | null, indent = false) {
    const checked = intToBool(task.done);
    const owner = staff.find((member) => member.id === task.owner_id) ?? null;
    const inlineEdit = editing && controls !== null;
    return (
      <div className={`flex min-h-[44px] w-full items-center gap-2 py-2.5 ${indent ? 'pl-7' : ''}`}>
        {inlineEdit && controls ? (
          <>
            <RenameField task={task} />
            <button
              type="button"
              aria-label="上へ"
              onClick={() => moveTask(controls.scope, controls.rows, task.id, 'up')}
              className="grid h-8 w-8 shrink-0 place-items-center rounded-md border border-line text-ink-light"
            >
              <ArrowUp size={15} />
            </button>
            <button
              type="button"
              aria-label="下へ"
              onClick={() => moveTask(controls.scope, controls.rows, task.id, 'down')}
              className="grid h-8 w-8 shrink-0 place-items-center rounded-md border border-line text-ink-light"
            >
              <ArrowDown size={15} />
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => setTaskDone(task, !checked)}
              className="flex flex-1 items-center gap-3 text-left"
            >
              <span
                className={`grid h-[21px] w-[21px] shrink-0 place-items-center rounded-md border-[1.6px] ${checked ? 'border-orange bg-orange' : 'border-orange-light'}`}
              >
                {checked ? <Check size={14} className="text-onaccent" /> : null}
              </span>
              <span
                className={`flex-1 text-[0.9rem] ${checked ? 'text-ink-mute line-through' : ''}`}
              >
                {task.title}
              </span>
            </button>
            {owner ? <Badge tone="wood">@{owner.name}</Badge> : null}
          </>
        )}
        {deleteButton(task, 0)}
      </div>
    );
  }

  // R14 (normal view): a row that has subtasks is a heading you open, not a box you
  // tick — its done state is derived from the children. The delete button stays a
  // SIBLING of the toggle: a button inside a button is not a valid control.
  function parentRow(node: TaskNode, open: boolean, listId: string) {
    const progress = parentProgress(node);
    const struck = effectiveDone(node);
    return (
      <div className="flex min-h-[44px] w-full items-center gap-2 py-2.5">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={listId}
          onClick={() => setOpenParents((prev) => ({ ...prev, [node.task.id]: !open }))}
          className="flex flex-1 items-center gap-3 text-left"
        >
          <span
            aria-label={`サブタスク ${progress.done}/${progress.total} 完了`}
            className={`grid h-[21px] shrink-0 place-items-center rounded-md border-[1.6px] px-1 text-[0.62rem] tabular-nums ${struck ? 'border-orange bg-orange text-onaccent' : 'border-orange-light text-ink-light'}`}
          >
            {progress.done}/{progress.total}
          </span>
          <span className={`flex-1 text-[0.9rem] ${struck ? 'text-ink-mute line-through' : ''}`}>
            {node.task.title}
          </span>
          <span className="shrink-0 text-ink-mute">
            {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </span>
        </button>
        {deleteButton(node.task, node.children.length)}
      </div>
    );
  }

  // A parent and its subtasks as one block. `siblings` is the duty's top level, so
  // ↑/↓ on the parent move it among the duty's rows and ↑/↓ on a child move it
  // among that parent's children only.
  function taskGroup(node: TaskNode, slot: SlotKey, siblings: TaskRow[]) {
    const task = node.task;
    const hasChildren = node.children.length > 0;
    // 編集 keeps every subtask visible: they are what is being edited.
    const open = editing || openParents[task.id] === true;
    const listId = `subtasks-${task.id}`;
    return (
      <div
        key={task.id}
        data-task={task.title ?? ''}
        className="border-line border-b border-dashed last:border-none"
      >
        {hasChildren && !editing
          ? parentRow(node, open, listId)
          : row(task, { scope: { slot }, rows: siblings })}
        {hasChildren && open ? (
          <div id={listId}>
            {node.children.map((child) => (
              <div key={child.id} className="border-line border-t border-dashed">
                {row(child, { scope: { parentId: task.id }, rows: node.children }, true)}
              </div>
            ))}
          </div>
        ) : null}
        {editing ? (
          <div className="flex items-center gap-2 pt-1 pb-2 pl-7">
            <input
              aria-label="サブタスクの名前"
              className="min-h-[36px] flex-1 rounded-[9px] border border-line bg-cream px-2 py-1.5 text-[0.85rem] outline-none focus:border-orange-light"
              value={subDraft[task.id] ?? ''}
              onChange={(event) =>
                setSubDraft((prev) => ({ ...prev, [task.id]: event.target.value }))
              }
            />
            <button
              type="button"
              aria-label="サブタスクを追加"
              onClick={() => addChild(task.id)}
              className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-orange text-onaccent"
            >
              <Plus size={15} />
            </button>
          </div>
        ) : null}
      </div>
    );
  }

  // Anything without a duty (one-offs, and any legacy row that predates 0026)
  // lands in 単発, so no task can become invisible. One-offs never have subtasks.
  const oneoffs = tasks.filter((task) => task.slot !== 'first' && task.slot !== 'second');

  return (
    <Screen>
      {isOwner ? (
        <div className="mb-1 flex justify-end">
          <button
            type="button"
            aria-pressed={editing}
            onClick={() => setEditing((prev) => !prev)}
            className={`min-h-[36px] rounded-full border px-4 text-[0.82rem] ${editing ? 'border-orange bg-orange/15 text-orange-deep' : 'border-line text-ink-light'}`}
          >
            編集
          </button>
        </div>
      ) : null}

      <div className="md:grid md:grid-cols-2 md:items-start md:gap-x-4 xl:grid-cols-3">
        {SLOTS.map((slot) => {
          const tree = buildTree(tasks.filter((task) => task.slot === slot.key));
          const siblings = tree.map((node) => node.task);
          return (
            <div key={slot.key}>
              <SectionLabel>{slot.label}</SectionLabel>
              <Card>
                {tree.length === 0 ? (
                  <EmptyState>タスクはありません。</EmptyState>
                ) : (
                  tree.map((node) => taskGroup(node, slot.key, siblings))
                )}
                {editing ? (
                  <div className="mt-2 flex items-center gap-2">
                    <input
                      aria-label={`${slot.label}に追加するタスク`}
                      className="min-h-[40px] flex-1 rounded-[9px] border border-line bg-cream px-2.5 py-2 text-[0.9rem] outline-none focus:border-orange-light"
                      value={slotDraft[slot.key] ?? ''}
                      onChange={(event) =>
                        setSlotDraft((prev) => ({ ...prev, [slot.key]: event.target.value }))
                      }
                    />
                    <button
                      type="button"
                      onClick={() => addToSlot(slot.key)}
                      className="min-h-[40px] shrink-0 rounded-[9px] bg-orange px-3 text-[0.8rem] text-onaccent"
                    >
                      この当番に追加
                    </button>
                  </div>
                ) : null}
              </Card>
            </div>
          );
        })}

        <div>
          <SectionLabel>単発</SectionLabel>
          <Card>
            {oneoffs.length === 0 ? (
              <EmptyState>タスクはありません。</EmptyState>
            ) : (
              oneoffs.map((task) => (
                <div key={task.id} className="border-line border-b border-dashed last:border-none">
                  {row(task, null)}
                </div>
              ))
            )}
          </Card>
        </div>
      </div>

      <div className="mt-2 flex items-center gap-2">
        <input
          className="min-h-[44px] flex-1 rounded-[11px] border border-line bg-cream px-3 py-2.5 text-base outline-none focus:border-orange-light"
          placeholder="単発タスクを追加…"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
        />
        <button
          type="button"
          aria-label="タスクを追加"
          onClick={addOneoff}
          className="grid h-[44px] w-[44px] shrink-0 place-items-center rounded-[11px] bg-orange text-onaccent"
        >
          <Plus size={18} />
        </button>
      </div>
    </Screen>
  );
}
