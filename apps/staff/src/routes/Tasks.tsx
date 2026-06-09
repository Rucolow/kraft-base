import { Check, Plus } from 'lucide-react';
import { useState } from 'react';
import { Badge, Card, EmptyState, Screen, SectionLabel } from '../components/ui';
import { useTasks } from '../data/queries';
import { nowIso } from '../lib/date';
import { insertRow, intToBool, uuid } from '../lib/db';
import { useSession } from '../lib/session';
import { setTaskDone } from '../lib/shiftOps';

const GROUPS: Array<{ key: string; label: string }> = [
  { key: 'daily', label: '毎日' },
  { key: 'per_checkout', label: 'チェックアウトごと' },
  { key: 'oneoff', label: '単発' },
];

export function Tasks() {
  const { isOwner, staff } = useSession();
  const { data: tasks } = useTasks();
  const [draft, setDraft] = useState('');

  async function addTask() {
    if (!draft.trim()) {
      return;
    }
    await insertRow('task', {
      id: uuid(),
      title: draft.trim(),
      group: 'oneoff',
      phase: null,
      source: 'adhoc',
      owner_id: null,
      done: 0,
      done_at: null,
      created_at: nowIso(),
    });
    setDraft('');
  }

  return (
    <Screen>
      {GROUPS.map((group) => {
        const items = tasks.filter((task) => task.group === group.key);
        return (
          <div key={group.key}>
            <SectionLabel>{group.label}</SectionLabel>
            <Card>
              {items.length === 0 ? (
                <EmptyState>タスクはありません。</EmptyState>
              ) : (
                items.map((task) => {
                  const checked = intToBool(task.done);
                  const owner = staff.find((member) => member.id === task.owner_id) ?? null;
                  return (
                    <button
                      key={task.id}
                      type="button"
                      onClick={() => setTaskDone(task, !checked)}
                      className="flex min-h-[44px] w-full items-center gap-3 border-line border-b border-dashed py-2.5 text-left last:border-none"
                    >
                      <span
                        className={`grid h-[21px] w-[21px] shrink-0 place-items-center rounded-md border-[1.6px] ${checked ? 'border-green bg-green' : 'border-green-light'}`}
                      >
                        {checked ? <Check size={14} className="text-paper" /> : null}
                      </span>
                      <span
                        className={`flex-1 text-[0.9rem] ${checked ? 'text-ink-mute line-through' : ''}`}
                      >
                        {task.title}
                      </span>
                      {owner ? <Badge tone="wood">@{owner.name}</Badge> : null}
                    </button>
                  );
                })
              )}
            </Card>
          </div>
        );
      })}

      {isOwner ? (
        <div className="mt-2 flex items-center gap-2">
          <input
            className="min-h-[44px] flex-1 rounded-[11px] border border-line bg-cream px-3 py-2.5 text-base outline-none focus:border-green-light"
            placeholder="単発タスクを追加…"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
          />
          <button
            type="button"
            aria-label="タスクを追加"
            onClick={addTask}
            className="grid h-[44px] w-[44px] shrink-0 place-items-center rounded-[11px] bg-green text-paper"
          >
            <Plus size={18} />
          </button>
        </div>
      ) : null}
    </Screen>
  );
}
