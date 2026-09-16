import { ArrowDown, ArrowUp, Check, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Badge, Card, EmptyState, Screen, SectionLabel } from '../components/ui';
import { useTasks } from '../data/queries';
import { intToBool } from '../lib/db';
import type { TaskRow } from '../lib/powersync/schema';
import { useSession } from '../lib/session';
import { setTaskDone } from '../lib/shiftOps';
import { addRoutineTask, addTask, moveTask, removeTask, renameTask } from '../lib/taskOps';

// R12: the two duties, in the order they run. 単発 (one-offs) is rendered AFTER
// both of them and that order is load-bearing for the e2e suites, which delete
// 「the last delete button」 expecting the one-off they just added.
const SLOTS = [
  { key: 'first', label: '先当番' },
  { key: 'second', label: '後当番' },
] as const;

type SlotKey = (typeof SLOTS)[number]['key'];

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

  // Deletion is owner-only — matches the task_delete RLS policy (is_owner). A
  // confirm guards against removing a recurring task by mistake. It stays outside
  // the 編集 toggle so the delete affordance is exactly where it has always been.
  async function confirmRemove(task: TaskRow) {
    if (!window.confirm(`「${task.title}」を削除しますか？`)) {
      return;
    }
    await removeTask(task.id);
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

  function row(task: TaskRow, controls: { slot: SlotKey; rows: TaskRow[] } | null) {
    const checked = intToBool(task.done);
    const owner = staff.find((member) => member.id === task.owner_id) ?? null;
    const inlineEdit = editing && controls !== null;
    return (
      <div
        key={task.id}
        className="flex min-h-[44px] w-full items-center gap-2 border-line border-b border-dashed py-2.5 last:border-none"
      >
        {inlineEdit && controls ? (
          <>
            <RenameField task={task} />
            <button
              type="button"
              aria-label="上へ"
              onClick={() => moveTask(controls.slot, controls.rows, task.id, 'up')}
              className="grid h-8 w-8 shrink-0 place-items-center rounded-md border border-line text-ink-light"
            >
              <ArrowUp size={15} />
            </button>
            <button
              type="button"
              aria-label="下へ"
              onClick={() => moveTask(controls.slot, controls.rows, task.id, 'down')}
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
        {isOwner ? (
          <button
            type="button"
            aria-label="タスクを削除"
            onClick={() => confirmRemove(task)}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-ink-mute"
          >
            <Trash2 size={15} />
          </button>
        ) : null}
      </div>
    );
  }

  // Anything without a duty (one-offs, and any legacy row that predates 0026)
  // lands in 単発, so no task can become invisible.
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
          const items = tasks.filter((task) => task.slot === slot.key);
          return (
            <div key={slot.key}>
              <SectionLabel>{slot.label}</SectionLabel>
              <Card>
                {items.length === 0 ? (
                  <EmptyState>タスクはありません。</EmptyState>
                ) : (
                  items.map((task) => row(task, { slot: slot.key, rows: items }))
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
              oneoffs.map((task) => row(task, null))
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
