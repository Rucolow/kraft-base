import { Bell, Check, ListChecks, ScrollText, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Badge, Card, CardHead, EmptyState, Screen } from '../components/ui';
import { useManualTasks, useMentions, useOpenFollowups, useTodaysGuests } from '../data/queries';
import { jstHour } from '../lib/date';
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
  const { currentStaff } = useSession();
  const hour = jstHour();
  const phases = cockpitPhases(hour);

  const { data: tasks } = useManualTasks(phases);
  const { data: guests } = useTodaysGuests();
  const { data: followups } = useOpenFollowups();
  const { data: mentions } = useMentions(currentStaff?.id ?? null);

  const arrived = guests.filter((guest) => guest.status === 'arrived').length;
  const late = guests.filter((guest) => guest.status === 'late');
  const done = tasks.filter((task) => intToBool(task.done)).length;

  return (
    <Screen>
      <div className="mb-4 overflow-hidden rounded-kb bg-green p-4 text-cream">
        <div className="font-heading text-[2.5rem] leading-none tracking-wide">
          {String(hour).padStart(2, '0')}:00
        </div>
        <div className="mt-1 text-[0.95rem] opacity-90">{shiftContextLabel(hour)}</div>
        {currentStaff ? (
          <div className="mt-3 text-[0.8rem] opacity-90">{currentStaff.name} のシフト</div>
        ) : null}
      </div>

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
                  className={`grid h-[21px] w-[21px] shrink-0 place-items-center rounded-md border-[1.6px] ${checked ? 'border-green bg-green' : 'border-green-light'}`}
                >
                  {checked ? <Check size={14} className="text-paper" /> : null}
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

      <Card onClick={() => navigate('/guests')}>
        <CardHead
          icon={<Users size={17} />}
          title="本日のチェックイン"
          trailing={
            <Badge tone="ok">
              {arrived} / {guests.length}
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
          {mentions.length > 0 ? '確認待ちの @メンションがあります。' : '新しい確認はありません。'}
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
    </Screen>
  );
}
