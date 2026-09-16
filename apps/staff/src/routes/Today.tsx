import {
  Bell,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
  ListChecks,
  ScrollText,
  Users,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { headcount } from '../components/GuestCard';
import { Badge, Card, CardHead, EmptyState, Screen } from '../components/ui';
import {
  useGuestsOnDate,
  useMentions,
  useOpenFollowups,
  useSlotTasks,
  useTodaysGuests,
} from '../data/queries';
import { usedBedChips } from '../lib/beds';
import { formatClock, jstHour, nowIso, shiftDate } from '../lib/date';
import { intToBool } from '../lib/db';
import { addDays } from '../lib/month';
import { useSession } from '../lib/session';
import { cockpitSlot, shiftContextLabel } from '../lib/shift';
import { setTaskDone } from '../lib/shiftOps';
import { buildTree, countLeaves, effectiveDone, parentProgress } from '../lib/taskTree';

// R12: 先当番 04:00–15:59 / 後当番 16:00–03:59.
const SLOT_LABEL: Record<string, string> = {
  first: '先当番のタスク',
  second: '後当番のタスク',
};

export function Today() {
  const navigate = useNavigate();
  const { currentStaff } = useSession();
  // Recomputed every render: the 30s clock below re-renders this screen, so the
  // list flips to 後当番 within half a minute of 16:00 without a reload.
  const hour = jstHour();
  const slot = cockpitSlot(hour);
  const [clock, setClock] = useState(() => formatClock(nowIso()));

  useEffect(() => {
    const timer = setInterval(() => setClock(formatClock(nowIso())), 30_000);
    return () => clearInterval(timer);
  }, []);

  const { data: tasks } = useSlotTasks(slot);
  // R14: which parents are open. Kept here (not in the row) so the list re-renders
  // from the watched query without ever collapsing itself — ticking the last child
  // leaves the group open, which is what the person expects while working down it.
  const [openParents, setOpenParents] = useState<Record<string, boolean>>({});
  const { data: guests } = useTodaysGuests();
  // R8: beds slept in last night — the cleaning/linen signal モーリー asked for.
  const { data: lastNightGuests } = useGuestsOnDate(addDays(shiftDate(), -1));
  const bedsUsed = usedBedChips(lastNightGuests);
  const { data: followups } = useOpenFollowups();
  const { data: mentions } = useMentions(currentStaff?.id ?? null);

  const active = guests.filter((guest) => guest.status !== 'cancelled');
  // Not-yet-arrived = expected AND late. Counting only 'late' made the card claim
  // 「全員到着済み」 every morning (nobody is marked 遅着 until they are overdue),
  // contradicting the 0名/4名 badge right beside it.
  const pending = active.filter((guest) => guest.status !== 'arrived');
  // People, not bookings: a party of N on one reservation counts as N.
  const activeHeads = headcount(guests);
  const arrivedHeads = headcount(active.filter((guest) => guest.status === 'arrived'));
  // Subtasks: parents with children are rows to open, not rows to tick, and the
  // counter measures the work itself (the leaves), not the headings.
  const tree = buildTree(tasks);
  const leaves = countLeaves(tree);

  return (
    <Screen>
      <div className="kb-grain-strong relative mb-4 flex items-center justify-between overflow-hidden rounded-kb bg-green p-4 text-ondark md:p-6">
        <div className="pointer-events-none absolute -top-10 -right-10 h-40 w-40 rounded-full bg-orange/20 blur-2xl" />
        <div className="relative">
          <div className="flex items-baseline gap-3">
            <span className="font-bold font-sans text-[2.2rem] leading-none tabular-nums md:text-[2.6rem]">
              {clock}
            </span>
            <span className="text-[0.95rem] opacity-90">{shiftContextLabel(hour)}</span>
          </div>
          {currentStaff ? (
            <div className="mt-3 text-[0.8rem] opacity-90">{currentStaff.name} のシフト</div>
          ) : null}
        </div>
      </div>

      <div className="lg:grid lg:grid-cols-3 lg:items-start lg:gap-4">
        <div className="lg:col-span-2">
          <Card primary>
            <CardHead
              icon={<ListChecks size={17} />}
              tone="orange"
              title={SLOT_LABEL[slot] ?? 'タスク'}
              trailing={
                <span className="text-[0.72rem] text-ink-mute">
                  {leaves.done} / {leaves.total}
                </span>
              }
            />
            {bedsUsed.length > 0 ? (
              <div className="mb-1 rounded-[9px] bg-wood/10 px-2.5 py-1.5 text-[0.78rem] text-ink">
                🛏 昨日使用ベッド: <span className="font-bold">{bedsUsed.join('・')}</span>
                <span className="ml-1 text-[0.68rem] text-ink-mute">（シーツ交換の目安）</span>
              </div>
            ) : null}
            {tree.length === 0 ? (
              <EmptyState>この当番のタスクはありません。</EmptyState>
            ) : (
              tree.map((node) => {
                const task = node.task;
                // A row with subtasks is a heading: it opens, it is never ticked.
                // Its done state is derived from the children (taskTree), so no
                // stale 1 can strike it through while a child is still open.
                if (node.children.length > 0) {
                  const open = openParents[task.id] === true;
                  const progress = parentProgress(node);
                  const struck = effectiveDone(node);
                  const listId = `subtasks-${task.id}`;
                  return (
                    <div
                      key={task.id}
                      className="border-line border-b border-dashed last:border-none"
                    >
                      <button
                        type="button"
                        aria-expanded={open}
                        aria-controls={listId}
                        onClick={() => setOpenParents((prev) => ({ ...prev, [task.id]: !open }))}
                        className="flex min-h-[44px] w-full items-center gap-3 py-2.5 text-left"
                      >
                        <span
                          aria-label={`サブタスク ${progress.done}/${progress.total} 完了`}
                          className={`grid h-[21px] shrink-0 place-items-center rounded-md border-[1.6px] px-1 text-[0.62rem] tabular-nums ${struck ? 'border-orange bg-orange text-onaccent' : 'border-orange-light text-ink-light'}`}
                        >
                          {progress.done}/{progress.total}
                        </span>
                        <span
                          className={`flex-1 text-[0.9rem] ${struck ? 'text-ink-mute line-through' : ''}`}
                        >
                          {task.title}
                        </span>
                        <span className="shrink-0 text-ink-mute">
                          {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                        </span>
                      </button>
                      {open ? (
                        <div id={listId} className="pb-1 pl-7">
                          {node.children.map((child) => {
                            const childChecked = intToBool(child.done);
                            return (
                              <button
                                key={child.id}
                                type="button"
                                onClick={() => setTaskDone(child, !childChecked)}
                                className="flex min-h-[44px] w-full items-center gap-3 border-line border-t border-dashed py-2.5 text-left"
                              >
                                <span
                                  className={`grid h-[21px] w-[21px] shrink-0 place-items-center rounded-md border-[1.6px] ${childChecked ? 'border-orange bg-orange' : 'border-orange-light'}`}
                                >
                                  {childChecked ? (
                                    <Check size={14} className="text-onaccent" />
                                  ) : null}
                                </span>
                                <span
                                  className={`flex-1 text-[0.86rem] ${childChecked ? 'text-ink-mute line-through' : ''}`}
                                >
                                  {child.title}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      ) : null}
                    </div>
                  );
                }
                const checked = intToBool(task.done);
                return (
                  <button
                    key={task.id}
                    type="button"
                    onClick={() => setTaskDone(task, !checked)}
                    className="flex min-h-[44px] w-full items-center gap-3 border-line border-b border-dashed py-2.5 text-left last:border-none"
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
                );
              })
            )}
          </Card>
        </div>

        <div className="md:grid md:grid-cols-2 md:items-start md:gap-x-3 lg:block">
          <Card onClick={() => navigate('/guests')}>
            <CardHead
              icon={<Users size={17} />}
              title="本日のチェックイン"
              trailing={
                <Badge tone="ok">
                  {arrivedHeads}名 / {activeHeads}名
                </Badge>
              }
            />
            <div className="text-[0.86rem] text-ink-light">
              {active.length === 0
                ? '本日のゲストはいません。'
                : pending.length > 0
                  ? `未着：${pending
                      .map((guest) => `${guest.name}様${guest.status === 'late' ? '（遅着）' : ''}`)
                      .join('・')}`
                  : '全員到着済み'}
            </div>
          </Card>

          <Card onClick={() => navigate('/comms')}>
            <CardHead
              icon={<Bell size={17} />}
              tone="orange"
              title="あなた宛て"
              trailing={
                <Badge tone={mentions.length > 0 ? 'warn' : 'neutral'}>{mentions.length}件</Badge>
              }
            />
            <div className="text-[0.86rem] text-ink-light">
              {mentions.length > 0
                ? '確認待ちの @メンションがあります。'
                : '新しい確認はありません。'}
            </div>
          </Card>

          <Card onClick={() => navigate('/handover')}>
            <CardHead
              icon={<ScrollText size={17} />}
              tone="wood"
              title="引き継ぎ"
              trailing={<Badge tone="wood">{followups.length}件</Badge>}
            />
            <div className="text-[0.86rem] text-ink-light">
              {followups.length > 0 ? '未完の申し送りがあります。' : '未完の申し送りはありません。'}
            </div>
          </Card>

          {/* R11: /shifts has no bottom-nav tab (the bar stays at 6) and no side-nav
              entry for staff, so this card is the entry point for everyone. */}
          <Card onClick={() => navigate('/shifts')}>
            <CardHead icon={<CalendarDays size={17} />} tone="wood" title="シフト" />
            <div className="text-[0.86rem] text-ink-light">休み希望・シフト表</div>
          </Card>
        </div>
      </div>
    </Screen>
  );
}
