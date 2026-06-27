import { Bell, Check, Clock, ListChecks, ScrollText, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge, Card, CardHead, EmptyState, Screen } from '../components/ui';
import { useManualTasks, useMentions, useOpenFollowups, useTodaysGuests } from '../data/queries';
import { formatClock, jstHour, nowIso } from '../lib/date';
import { intToBool } from '../lib/db';
import { useSession } from '../lib/session';
import { cockpitPhases, shiftContextLabel } from '../lib/shift';
import { setTaskDone } from '../lib/shiftOps';

const PHASE_LABEL: Record<string, string> = {
  midday_prep: '受付準備',
  cleaning: '清掃',
  evening_close: 'クローズ前',
  morning_prep: '翌朝セット',
};

export function Today() {
  const navigate = useNavigate();
  const { currentStaff, isOwner } = useSession();
  const hour = jstHour();
  const phases = cockpitPhases(hour);
  const [clock, setClock] = useState(() => formatClock(nowIso()));

  useEffect(() => {
    const timer = setInterval(() => setClock(formatClock(nowIso())), 30_000);
    return () => clearInterval(timer);
  }, []);

  const { data: tasks } = useManualTasks(phases);
  const { data: guests } = useTodaysGuests();
  const { data: followups } = useOpenFollowups();
  const { data: mentions } = useMentions(currentStaff?.id ?? null);

  const active = guests.filter((guest) => guest.status !== 'cancelled');
  const arrived = active.filter((guest) => guest.status === 'arrived').length;
  const late = active.filter((guest) => guest.status === 'late');
  const done = tasks.filter((task) => intToBool(task.done)).length;

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
              title={phases.map((phase) => PHASE_LABEL[phase]).join('・')}
              trailing={
                <span className="text-[0.72rem] text-ink-mute">
                  {done} / {tasks.length}
                </span>
              }
            />
            {tasks.length === 0 ? (
              <EmptyState>この時間帯の定型はありません。</EmptyState>
            ) : (
              tasks.map((task) => {
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
                      {checked ? <Check size={14} className="text-ondark" /> : null}
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
                  {arrived} / {active.length}
                </Badge>
              }
            />
            <div className="text-[0.86rem] text-ink-light">
              {guests.length === 0
                ? '本日のゲストは未登録です。'
                : late.length > 0
                  ? `未着：${late.map((guest) => `${guest.name}様`).join('・')}`
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

          {/* Worktime lives in the side nav on tablet/desktop; surface it here for
              phone owners, where it is intentionally dropped from the bottom nav. */}
          {isOwner ? (
            <div className="md:hidden">
              <Card onClick={() => navigate('/worktime')}>
                <CardHead icon={<Clock size={17} />} tone="wood" title="勤務（給与）" />
                <div className="text-[0.86rem] text-ink-light">
                  スタッフの勤務時間を月別に確認します。
                </div>
              </Card>
            </div>
          ) : null}
        </div>
      </div>
    </Screen>
  );
}
