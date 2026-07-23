import { Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BentoDayPanel, BentoSummaryLine, guestOrderChip } from '../components/BentoOrders';
import { GuestList, headcount, isActive } from '../components/GuestCard';
import { EmptyState, Screen, SectionLabel } from '../components/ui';
import { useBentoOrdersAfter, useTodaysGuests, useUpcomingGuests } from '../data/queries';
import { isVisibleOrder } from '../lib/bento';
import { formatStayDate, shiftDate } from '../lib/date';
import type { BentoOrderRow, GuestRow } from '../lib/powersync/schema';
import { useSession } from '../lib/session';
import { GuestCalendar } from './GuestCalendar';

type Tab = 'today' | 'upcoming' | 'calendar';

export function Guests() {
  const navigate = useNavigate();
  const { isOwner } = useSession();
  const { data: today } = useTodaysGuests();
  const { data: upcoming } = useUpcomingGuests();
  const { data: futureOrders } = useBentoOrdersAfter(shiftDate());
  const [tab, setTab] = useState<Tab>('today');

  // One tick drives the 45-min PENDING→hidden rule for every future date's
  // summary line (the parent owns it so we don't spawn a timer per date group).
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 5 * 60_000);
    return () => clearInterval(timer);
  }, []);

  // Tabs and headers count PEOPLE (Σ party_size), not bookings — a party of 3 on
  // one reservation must read as 3, not 1. Keep the booking count for the "N組".
  const todayGroups = today.filter(isActive).length;
  const todayHeads = headcount(today);
  const upcomingHeads = headcount(upcoming);

  // Future bento orders (one watch), grouped by delivery date and by linked guest.
  const ordersByDate = new Map<string, BentoOrderRow[]>();
  for (const order of futureOrders) {
    const date = order.delivery_date ?? '';
    if (!date) {
      continue;
    }
    const arr = ordersByDate.get(date);
    if (arr) {
      arr.push(order);
    } else {
      ordersByDate.set(date, [order]);
    }
  }
  const chipByGuest = new Map<string, string | null>();
  const linkedByGuest = new Map<string, BentoOrderRow[]>();
  for (const order of futureOrders) {
    if (!order.guest_id) {
      continue;
    }
    const arr = linkedByGuest.get(order.guest_id);
    if (arr) {
      arr.push(order);
    } else {
      linkedByGuest.set(order.guest_id, [order]);
    }
  }
  for (const [guestId, orders] of linkedByGuest) {
    chipByGuest.set(guestId, guestOrderChip(orders));
  }

  // Upcoming stays grouped by date, unioned with order-only dates (bento but no
  // staying guest yet) so meals to prepare are never hidden. upcoming is already
  // date-sorted, so per-date guest order (by checkin) is preserved in the Map.
  const guestsByDate = new Map<string, GuestRow[]>();
  for (const guest of upcoming) {
    const date = guest.stay_date ?? '';
    const arr = guestsByDate.get(date);
    if (arr) {
      arr.push(guest);
    } else {
      guestsByDate.set(date, [guest]);
    }
  }
  const orderOnlyDates = [...ordersByDate.entries()]
    .filter(([, orders]) => orders.some((order) => isVisibleOrder(order, now)))
    .map(([date]) => date);
  const upcomingDates = [...new Set([...guestsByDate.keys(), ...orderOnlyDates])]
    .filter(Boolean)
    .sort();

  const open = (id: string) => navigate(`/guests/${id}`);

  return (
    <Screen>
      <div className="mb-4 flex items-center gap-2">
        <div className="flex flex-1 flex-wrap gap-2">
          {(
            [
              ['today', '今日', todayHeads],
              ['upcoming', 'これから先', upcomingHeads],
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
          <BentoDayPanel date={shiftDate()} />
          <SectionLabel>
            本日のゲスト — <span className="font-sans tabular-nums">{todayGroups}</span>組{' '}
            <span className="font-sans tabular-nums">{todayHeads}</span>名
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
        upcomingDates.length === 0 ? (
          <EmptyState>これから先の予約はありません。</EmptyState>
        ) : (
          upcomingDates.map((date) => {
            const dayGuests = guestsByDate.get(date) ?? [];
            const dayOrders = ordersByDate.get(date) ?? [];
            return (
              <div key={date} className="mb-5">
                <SectionLabel>
                  {formatStayDate(date)}
                  {dayGuests.length > 0 ? (
                    <>
                      {' — '}
                      <span className="font-sans tabular-nums">
                        {dayGuests.filter(isActive).length}
                      </span>
                      組 <span className="font-sans tabular-nums">{headcount(dayGuests)}</span>名
                    </>
                  ) : null}
                </SectionLabel>
                {dayOrders.length > 0 ? <BentoSummaryLine orders={dayOrders} now={now} /> : null}
                {dayGuests.length > 0 ? (
                  <GuestList guests={dayGuests} onOpen={open} bentoByGuest={chipByGuest} />
                ) : null}
              </div>
            );
          })
        )
      ) : (
        <GuestCalendar />
      )}
    </Screen>
  );
}
