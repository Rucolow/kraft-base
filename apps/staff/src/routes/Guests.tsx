import { Plus } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge, Card, EmptyState, Screen, SectionLabel } from '../components/ui';
import { useTodaysGuests, useUpcomingGuests } from '../data/queries';
import { formatStayDate } from '../lib/date';
import { guestStatusMeta } from '../lib/guestStatus';
import type { GuestRow } from '../lib/powersync/schema';
import { useSession } from '../lib/session';

type Tab = 'today' | 'upcoming';

function GuestCard({ guest, onOpen }: { guest: GuestRow; onOpen: () => void }) {
  const status = guestStatusMeta(guest.status);
  const cancelled = guest.status === 'cancelled';
  return (
    <Card onClick={onOpen}>
      <div className={`flex items-center gap-2.5 ${cancelled ? 'opacity-55' : ''}`}>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className={`font-bold text-[0.96rem] ${cancelled ? 'line-through' : ''}`}>
              {guest.name}
            </span>
            {guest.whole_house === 1 ? <Badge tone="wood">貸切</Badge> : null}
          </div>
          <div className="mt-0.5 text-[0.76rem] text-ink-light">
            {guest.country}・{guest.party_size}名 ／ IN {guest.checkin_time}・{guest.bed}
          </div>
        </div>
        <Badge tone={status.tone}>{status.label}</Badge>
      </div>
    </Card>
  );
}

export function Guests() {
  const navigate = useNavigate();
  const { isOwner } = useSession();
  const { data: today } = useTodaysGuests();
  const { data: upcoming } = useUpcomingGuests();
  const [tab, setTab] = useState<Tab>('today');

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
        <div className="flex flex-1 gap-2">
          {(
            [
              ['today', '今日', today.length],
              ['upcoming', 'これから先', upcoming.length],
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
              <span className="tabular-nums">{count}</span>
            </button>
          ))}
        </div>
        {isOwner ? (
          <button
            type="button"
            onClick={() => navigate('/guests/new')}
            className="flex min-h-[40px] items-center gap-1 rounded-full bg-orange px-3 font-bold text-[0.74rem] text-ondark"
          >
            <Plus size={14} /> 追加
          </button>
        ) : null}
      </div>

      {tab === 'today' ? (
        <>
          <SectionLabel>
            本日のゲスト — <span className="font-sans tabular-nums">{today.length}</span>名
          </SectionLabel>
          {today.length === 0 ? (
            <EmptyState>
              本日のゲストは未登録です。予約は9–13にオーナーがOTAから確定します。
            </EmptyState>
          ) : (
            <div className="md:grid md:grid-cols-2 md:items-start md:gap-x-3 xl:grid-cols-3">
              {today.map((guest) => (
                <GuestCard key={guest.id} guest={guest} onOpen={() => open(guest.id)} />
              ))}
            </div>
          )}
        </>
      ) : groups.length === 0 ? (
        <EmptyState>これから先の予約はありません。</EmptyState>
      ) : (
        groups.map((group) => (
          <div key={group.date} className="mb-5">
            <SectionLabel>
              {formatStayDate(group.date)} —{' '}
              <span className="font-sans tabular-nums">{group.guests.length}</span>名
            </SectionLabel>
            <div className="md:grid md:grid-cols-2 md:items-start md:gap-x-3 xl:grid-cols-3">
              {group.guests.map((guest) => (
                <GuestCard key={guest.id} guest={guest} onOpen={() => open(guest.id)} />
              ))}
            </div>
          </div>
        ))
      )}
    </Screen>
  );
}
