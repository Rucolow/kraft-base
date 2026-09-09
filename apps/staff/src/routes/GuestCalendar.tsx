import { CalendarDays } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BentoDayPanel } from '../components/BentoOrders';
import { GuestList, headcount, isActive } from '../components/GuestCard';
import { MonthGrid, ShiftChips, UnavailMarks } from '../components/MonthGrid';
import { Badge, EmptyState, SectionLabel } from '../components/ui';
import {
  useGuestsInMonth,
  useShiftPlansInMonth,
  useStaff,
  useUnavailableInMonth,
} from '../data/queries';
import { formatStayDate, shiftDate } from '../lib/date';
import { addMonth } from '../lib/month';
import type { GuestRow, ShiftPlanRow, StaffRow } from '../lib/powersync/schema';
import { isRosterMember, useSession } from '../lib/session';
import { isUnavailable, unavailableByDay } from '../lib/shiftAvail';

function bucket<T>(rows: T[], keyOf: (row: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    const key = keyOf(row);
    const arr = map.get(key);
    if (arr) {
      arr.push(row);
    } else {
      map.set(key, [row]);
    }
  }
  return map;
}

// R6: guests AND shifts in one calendar (モーリー: 「切り替えることなしで確認したい」).
// R11: read-only — every rota edit now lives on /shifts, so this screen can be
// opened during a busy check-in without a stray tap reassigning someone.
export function GuestCalendar() {
  const navigate = useNavigate();
  const { isOwner } = useSession();
  const [month, setMonth] = useState(() => shiftDate().slice(0, 7));
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const { data: monthGuests } = useGuestsInMonth(month);
  const { data: monthPlans } = useShiftPlansInMonth(month);
  const { data: monthUnavail } = useUnavailableInMonth(month);
  const { data: staff } = useStaff();

  const byDayGuests = bucket<GuestRow>(monthGuests, (g) => g.stay_date ?? '');
  const byDayPlans = bucket<ShiftPlanRow>(monthPlans, (p) => p.date ?? '');
  const staffById = new Map<string, StaffRow>(staff.map((member) => [member.id, member]));
  // 「入れない日」 is a planning signal, so it is shown to the owner only — staff
  // read their own on /shifts.
  const unavailable = unavailableByDay(isOwner ? monthUnavail : []);

  const selectedGuests = selectedDay ? (byDayGuests.get(selectedDay) ?? []) : [];
  const selectedActive = selectedGuests.filter(isActive);
  const selectedHeads = headcount(selectedGuests);
  const selectedPlans = selectedDay ? (byDayPlans.get(selectedDay) ?? []) : [];
  const selectedUnavail = selectedDay
    ? staff
        .filter(isRosterMember)
        .filter((member) => isUnavailable(unavailable, selectedDay, member.id))
    : [];

  const openGuest = (id: string) => navigate(`/guests/${id}`);
  const goMonth = (delta: number) => {
    setMonth((current) => addMonth(current, delta));
    setSelectedDay(null);
  };

  return (
    <>
      <MonthGrid
        month={month}
        onMonth={goMonth}
        selected={selectedDay}
        onSelect={setSelectedDay}
        dayTone={(day) =>
          (byDayGuests.get(day) ?? []).filter(isActive).some((g) => g.whole_house === 1)
            ? 'border-wood/40 bg-wood/15'
            : null
        }
        renderDay={(day) => {
          const dayGuests = byDayGuests.get(day) ?? [];
          const dayActive = dayGuests.filter(isActive);
          const heads = headcount(dayGuests);
          const whole = dayActive.some((g) => g.whole_house === 1);
          return (
            <>
              {dayActive.length > 0 ? (
                <span className="mt-0.5 font-bold text-orange leading-none">
                  <span className="text-[0.72rem] md:hidden">{heads}名</span>
                  <span className="hidden text-[0.68rem] md:inline">
                    {dayActive.length}組{heads}名
                  </span>
                </span>
              ) : null}
              {whole ? <span className="mt-0.5 text-[0.56rem] text-wood">貸切</span> : null}
              <ShiftChips plans={byDayPlans.get(day) ?? []} staffById={staffById} />
              <UnavailMarks mine={false} others={(unavailable.get(day) ?? []).length} />
            </>
          );
        }}
      />

      <div className="mt-4">
        {!selectedDay ? (
          <p className="px-1 text-center text-[0.82rem] text-ink-mute">
            日付をタップすると、その日のゲストとシフトが表示されます。
          </p>
        ) : (
          <>
            <SectionLabel>
              {formatStayDate(selectedDay)} —{' '}
              <span className="font-sans tabular-nums">{selectedActive.length}</span>組{' '}
              <span className="font-sans tabular-nums">{selectedHeads}</span>名
            </SectionLabel>
            <BentoDayPanel date={selectedDay} compact />
            {selectedGuests.length === 0 ? (
              <EmptyState>この日の予約はありません。</EmptyState>
            ) : (
              <GuestList guests={selectedGuests} onOpen={openGuest} />
            )}
            <SectionLabel>{formatStayDate(selectedDay)} のシフト</SectionLabel>
            {isOwner && selectedUnavail.length > 0 ? (
              <div className="mb-2 px-1 text-[0.82rem] text-ink-light">
                入れない:{' '}
                <span className="font-bold text-orange">
                  {selectedUnavail.map((member) => member.name).join(', ')}
                </span>
              </div>
            ) : null}
            {selectedPlans.length === 0 ? (
              <EmptyState>この日の割り当てはありません。</EmptyState>
            ) : (
              <div className="mb-2">
                {selectedPlans.map((plan) => {
                  const member = plan.staff_id ? staffById.get(plan.staff_id) : undefined;
                  return (
                    <div
                      key={plan.id}
                      className="mb-2 flex items-center gap-2.5 rounded-kb border border-line bg-paper px-3 py-2.5"
                    >
                      <span
                        className="h-3 w-3 shrink-0 rounded-full"
                        style={{ backgroundColor: member?.accent ?? '#8a8a8a' }}
                      />
                      <span className="flex-1 font-bold text-[0.92rem]">
                        {member?.name ?? '不明なスタッフ'}
                      </span>
                      {plan.label ? <Badge tone="neutral">{plan.label}</Badge> : null}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
        <button
          type="button"
          onClick={() => navigate('/shifts')}
          className="mt-1 flex min-h-[44px] items-center gap-1.5 rounded-full border border-line px-4 font-bold text-[0.82rem] text-ink-light"
        >
          <CalendarDays size={15} /> シフト画面へ
        </button>
      </div>
    </>
  );
}
