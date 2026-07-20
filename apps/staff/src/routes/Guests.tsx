import { Plus } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GuestList, isActive } from '../components/GuestCard';
import { EmptyState, Screen, SectionLabel } from '../components/ui';
import { useTodaysGuests, useUpcomingGuests } from '../data/queries';
import { formatStayDate } from '../lib/date';
import type { GuestRow } from '../lib/powersync/schema';
import { useSession } from '../lib/session';
import { GuestCalendar } from './GuestCalendar';

type Tab = 'today' | 'upcoming' | 'calendar';

export function Guests() {
  const navigate = useNavigate();
  const { isOwner } = useSession();
  const { data: today } = useTodaysGuests();
  const { data: upcoming } = useUpcomingGuests();
  const [tab, setTab] = useState<Tab>('today');

  const todayCount = today.filter(isActive).length;
  const upcomingCount = upcoming.filter(isActive).length;

  // Upcoming stays are already ordered by date; collapse into per-date groups.
  const groups: Array<{ date: string; guests: GuestRow[] }> = [];
  for (const guest of upcoming) {
    const date = guest.stay_date ?? '';
    const last = groups.at(-1);
    if (last && last.date === date) {
      last.guests.push(guest);
    } else {
      groups.push({ date, guests: [guest] });
    }
  }

  const open = (id: string) => navigate(`/guests/${id}`);

  return (
    <Screen>
      <div className="mb-4 flex items-center gap-2">
        <div className="flex flex-1 flex-wrap gap-2">
          {(
            [
              ['today', '今日', todayCount],
              ['upcoming', 'これから先', upcomingCount],
              ['calendar', 'カレンダー', null],
            ] as const
          ).map(([key, label, count]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`flex min-h-[40px] items-center gap-1.5 rounded-full border px-4 font-bold text-[0.84rem] ${
                tab === key
                  ? 'border-orange bg-orange/15 text-orange'
                  : 'border-line text-ink-light'
              }`}
            >
              {label}
              {count !== null ? <span className="tabular-nums">{count}</span> : null}
            </button>
          ))}
        </div>
        {isOwner ? (
          <button
            type="button"
            onClick={() => navigate('/guests/new')}
            className="flex min-h-[40px] items-center gap-1 rounded-full bg-orange px-3 font-bold text-[0.74rem] text-onaccent"
          >
            <Plus size={14} /> 追加
          </button>
        ) : null}
      </div>

      {tab === 'today' ? (
        <>
          <SectionLabel>
            本日のゲスト — <span className="font-sans tabular-nums">{todayCount}</span>名
          </SectionLabel>
          {today.length === 0 ? (
            <EmptyState>
              本日のゲストは未登録です。予約は9–13にオーナーがOTAから確定します。
            </EmptyState>
          ) : (
            <GuestList guests={today} onOpen={open} />
          )}
        </>
      ) : tab === 'upcoming' ? (
        groups.length === 0 ? (
          <EmptyState>これから先の予約はありません。</EmptyState>
        ) : (
          groups.map((group) => (
            <div key={group.date} className="mb-5">
              <SectionLabel>
                {formatStayDate(group.date)} —{' '}
                <span className="font-sans tabular-nums">
                  {group.guests.filter(isActive).length}
                </span>
                名
              </SectionLabel>
              <GuestList guests={group.guests} onOpen={open} />
            </div>
          ))
        )
      ) : (
        <GuestCalendar />
      )}
    </Screen>
  );
}
