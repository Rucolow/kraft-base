import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge, Card, EmptyState, Screen, SectionLabel } from '../components/ui';
import { useGuestsInMonth, useTodaysGuests, useUpcomingGuests } from '../data/queries';
import { formatStayDate, shiftDate } from '../lib/date';
import { guestStatusMeta } from '../lib/guestStatus';
import { addMonth, monthDays, monthLabel, monthLeadingBlanks } from '../lib/month';
import type { GuestRow } from '../lib/powersync/schema';
import { useSession } from '../lib/session';

type Tab = 'today' | 'upcoming' | 'calendar';
type CalView = 'guest' | 'shift';

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

function GuestCard({ guest, onOpen }: { guest: GuestRow; onOpen: () => void }) {
  const status = guestStatusMeta(guest.status);
  const cancelled = guest.status === 'cancelled';
  // Build the meta line from present fields only, so a missing country, time or
  // bed doesn't leave a dangling separator (e.g. "IN 19:00・" with no bed).
  const meta = [guest.country, `${guest.party_size ?? 1}名`].filter(Boolean).join('・');
  // "未定" checkin time is surfaced as a badge (an all-day wait is an exception
  // worth spotting), so keep it out of the muted meta line to avoid duplication.
  const undecidedCheckin = guest.checkin_time === '未定';
  const inParts = [undecidedCheckin ? null : guest.checkin_time, guest.bed]
    .filter(Boolean)
    .join('・');
  return (
    <Card onClick={onOpen}>
      <div className={`flex items-center gap-2.5 ${cancelled ? 'opacity-55' : ''}`}>
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`font-bold text-[0.96rem] ${cancelled ? 'line-through' : ''}`}>
              {guest.name}
            </span>
            {guest.whole_house === 1 ? <Badge tone="wood">貸切</Badge> : null}
            {undecidedCheckin ? <Badge tone="warn">IN未定</Badge> : null}
          </div>
          <div className="mt-0.5 text-[0.76rem] text-ink-light">
            {meta}
            {inParts ? ` ／ IN ${inParts}` : ''}
          </div>
        </div>
        <Badge tone={status.tone}>{status.label}</Badge>
      </div>
    </Card>
  );
}

// Cancelled guests stay visible (greyed) but must not inflate headcounts used for
// prep — kept consistent with the home cockpit, which counts active guests only.
const isActive = (guest: GuestRow) => guest.status !== 'cancelled';

function GuestList({ guests, onOpen }: { guests: GuestRow[]; onOpen: (id: string) => void }) {
  return (
    <div className="md:grid md:grid-cols-2 md:items-start md:gap-x-3 xl:grid-cols-3">
      {guests.map((guest) => (
        <GuestCard key={guest.id} guest={guest} onOpen={() => onOpen(guest.id)} />
      ))}
    </div>
  );
}

export function Guests() {
  const navigate = useNavigate();
  const { isOwner } = useSession();
  const { data: today } = useTodaysGuests();
  const { data: upcoming } = useUpcomingGuests();
  const [tab, setTab] = useState<Tab>('today');
  const [month, setMonth] = useState(() => shiftDate().slice(0, 7));
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [calView, setCalView] = useState<CalView>('guest');
  const { data: monthGuests } = useGuestsInMonth(month);

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

  // Calendar: bucket the month's guests by day (all statuses; counts filter later).
  const byDay = new Map<string, GuestRow[]>();
  for (const guest of monthGuests) {
    const date = guest.stay_date ?? '';
    const arr = byDay.get(date);
    if (arr) {
      arr.push(guest);
    } else {
      byDay.set(date, [guest]);
    }
  }
  const selectedGuests = selectedDay ? (byDay.get(selectedDay) ?? []) : [];
  const selectedActive = selectedGuests.filter(isActive);
  const selectedHeads = selectedActive.reduce((sum, g) => sum + (g.party_size ?? 1), 0);

  const open = (id: string) => navigate(`/guests/${id}`);
  const goMonth = (delta: number) => {
    setMonth((current) => addMonth(current, delta));
    setSelectedDay(null);
  };

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
        <>
          {/* View toggle. ゲスト is live now; シフト is the PR-3 skeleton. */}
          <div className="mb-3 flex gap-2">
            {(
              [
                ['guest', 'ゲスト'],
                ['shift', 'シフト'],
              ] as const
            ).map(([view, label]) => (
              <button
                key={view}
                type="button"
                disabled={view === 'shift'}
                onClick={() => setCalView(view)}
                className={`flex min-h-[36px] flex-1 items-center justify-center rounded-full border px-3 font-bold text-[0.82rem] ${
                  calView === view
                    ? 'border-orange bg-orange/15 text-orange'
                    : 'border-line text-ink-light'
                } ${view === 'shift' ? 'opacity-40' : ''}`}
              >
                {label}
                {view === 'shift' ? (
                  <span className="ml-1 font-normal text-[0.66rem]">（準備中）</span>
                ) : null}
              </button>
            ))}
          </div>

          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              aria-label="前の月"
              onClick={() => goMonth(-1)}
              className="grid h-10 w-10 place-items-center rounded-full border border-line text-ink-light"
            >
              <ChevronLeft size={20} />
            </button>
            <div className="font-bold text-[1.05rem] tabular-nums">{monthLabel(month)}</div>
            <button
              type="button"
              aria-label="次の月"
              onClick={() => goMonth(1)}
              className="grid h-10 w-10 place-items-center rounded-full border border-line text-ink-light"
            >
              <ChevronRight size={20} />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-[0.66rem] text-ink-mute">
            {WEEKDAYS.map((weekday, index) => (
              <div
                key={weekday}
                className={index === 0 ? 'text-orange-deep' : index === 6 ? 'text-wood' : ''}
              >
                {weekday}
              </div>
            ))}
          </div>

          <div className="mt-1 grid grid-cols-7 gap-1">
            {Array.from({ length: monthLeadingBlanks(month) }, (_, index) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: fixed leading blanks, order stable
              <div key={`blank-${index}`} />
            ))}
            {monthDays(month).map((day) => {
              const dayActive = (byDay.get(day) ?? []).filter(isActive);
              const groupCount = dayActive.length;
              const headCount = dayActive.reduce((sum, g) => sum + (g.party_size ?? 1), 0);
              const whole = dayActive.some((g) => g.whole_house === 1);
              const isToday = day === shiftDate();
              const isSel = day === selectedDay;
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => setSelectedDay(day)}
                  className={`flex min-h-[52px] flex-col items-center rounded-[10px] border px-0.5 pt-1 pb-0.5 ${
                    isSel
                      ? 'border-orange bg-orange/15'
                      : whole
                        ? 'border-wood/40 bg-wood/15'
                        : 'border-line bg-paper'
                  }`}
                >
                  <span
                    className={`text-[0.68rem] ${isToday ? 'font-bold text-orange' : 'text-ink-light'}`}
                  >
                    {Number(day.slice(-2))}
                  </span>
                  {groupCount > 0 ? (
                    <span className="mt-0.5 font-bold text-orange leading-none">
                      <span className="text-[0.72rem] md:hidden">{headCount}名</span>
                      <span className="hidden text-[0.68rem] md:inline">
                        {groupCount}組{headCount}名
                      </span>
                    </span>
                  ) : null}
                  {whole ? <span className="mt-0.5 text-[0.56rem] text-wood">貸切</span> : null}
                </button>
              );
            })}
          </div>

          <div className="mt-4">
            {selectedDay ? (
              <>
                <SectionLabel>
                  {formatStayDate(selectedDay)} —{' '}
                  <span className="font-sans tabular-nums">{selectedActive.length}</span>組{' '}
                  <span className="font-sans tabular-nums">{selectedHeads}</span>名
                </SectionLabel>
                {selectedGuests.length === 0 ? (
                  <EmptyState>この日の予約はありません。</EmptyState>
                ) : (
                  <GuestList guests={selectedGuests} onOpen={open} />
                )}
              </>
            ) : (
              <p className="px-1 text-center text-[0.82rem] text-ink-mute">
                日付をタップすると、その日のゲストが表示されます。
              </p>
            )}
          </div>
        </>
      )}
    </Screen>
  );
}
