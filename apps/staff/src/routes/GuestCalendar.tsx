import { ChevronLeft, ChevronRight, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BentoDayPanel } from '../components/BentoOrders';
import { GuestList, headcount, isActive } from '../components/GuestCard';
import { Badge, EmptyState, SectionLabel } from '../components/ui';
import { useGuestsInMonth, useShiftPlansInMonth, useStaff } from '../data/queries';
import { formatStayDate, shiftDate } from '../lib/date';
import { addMonth, monthDays, monthLabel, monthLeadingBlanks } from '../lib/month';
import type { GuestRow, ShiftPlanRow, StaffRow } from '../lib/powersync/schema';
import { useSession } from '../lib/session';
import {
  addShiftPlan,
  addShiftPlanRange,
  copyPrevWeek,
  removeShiftPlan,
} from '../lib/shiftPlanOps';

type CalView = 'guest' | 'shift';

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];
const FIELD =
  'min-h-[44px] rounded-[10px] border border-line bg-cream px-3 py-2 text-[0.9rem] text-ink outline-none focus:border-orange-light';

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

export function GuestCalendar() {
  const navigate = useNavigate();
  const { isOwner, currentStaff } = useSession();
  const [month, setMonth] = useState(() => shiftDate().slice(0, 7));
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [calView, setCalView] = useState<CalView>('guest');

  const { data: monthGuests } = useGuestsInMonth(month);
  const { data: monthPlans } = useShiftPlansInMonth(month);
  const { data: staff } = useStaff();

  // Shift-editing form state (owner only).
  const [addStaff, setAddStaff] = useState('');
  const [addLabel, setAddLabel] = useState('');
  const [rangeOpen, setRangeOpen] = useState(false);
  const [rangeStart, setRangeStart] = useState('');
  const [rangeEnd, setRangeEnd] = useState('');
  const [rangeStaff, setRangeStaff] = useState('');
  const [busy, setBusy] = useState(false);

  const byDayGuests = bucket<GuestRow>(monthGuests, (g) => g.stay_date ?? '');
  const byDayPlans = bucket<ShiftPlanRow>(monthPlans, (p) => p.date ?? '');
  const staffById = new Map<string, StaffRow>(staff.map((member) => [member.id, member]));
  const rosterStaff = staff.filter((member) => !member.is_device);

  const selectedGuests = selectedDay ? (byDayGuests.get(selectedDay) ?? []) : [];
  const selectedActive = selectedGuests.filter(isActive);
  const selectedHeads = headcount(selectedGuests);
  const selectedPlans = selectedDay ? (byDayPlans.get(selectedDay) ?? []) : [];

  const openGuest = (id: string) => navigate(`/guests/${id}`);
  const goMonth = (delta: number) => {
    setMonth((current) => addMonth(current, delta));
    setSelectedDay(null);
  };

  // try/finally so a rejected write never leaves `busy` stuck true (which would
  // wedge every edit button until the component remounts).
  async function doAdd() {
    if (!selectedDay || !addStaff || busy) {
      return;
    }
    setBusy(true);
    try {
      await addShiftPlan({
        date: selectedDay,
        staffId: addStaff,
        label: addLabel || null,
        createdBy: currentStaff?.id ?? null,
      });
      setAddStaff('');
      setAddLabel('');
    } finally {
      setBusy(false);
    }
  }

  async function doRange() {
    if (!rangeStart || !rangeEnd || !rangeStaff || busy) {
      return;
    }
    setBusy(true);
    try {
      const [start, end] = rangeStart <= rangeEnd ? [rangeStart, rangeEnd] : [rangeEnd, rangeStart];
      // The range tool has no label field, so assign unlabeled (don't leak the
      // add-form's label); the owner can label individual days afterward.
      await addShiftPlanRange({
        start,
        end,
        staffId: rangeStaff,
        label: null,
        createdBy: currentStaff?.id ?? null,
      });
      setRangeOpen(false);
      setRangeStaff('');
    } finally {
      setBusy(false);
    }
  }

  async function doCopyWeek() {
    if (!selectedDay || busy) {
      return;
    }
    setBusy(true);
    try {
      await copyPrevWeek(selectedDay, currentStaff?.id ?? null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
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
            onClick={() => setCalView(view)}
            className={`flex min-h-[36px] flex-1 items-center justify-center rounded-full border px-3 font-bold text-[0.82rem] ${
              calView === view
                ? 'border-orange bg-orange/15 text-orange'
                : 'border-line text-ink-light'
            }`}
          >
            {label}
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
          const dayGuests = byDayGuests.get(day) ?? [];
          const dayActive = dayGuests.filter(isActive);
          const headCount = headcount(dayGuests);
          const whole = dayActive.some((g) => g.whole_house === 1);
          const plans = byDayPlans.get(day) ?? [];
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
                  : calView === 'guest' && whole
                    ? 'border-wood/40 bg-wood/15'
                    : 'border-line bg-paper'
              }`}
            >
              <span
                className={`text-[0.68rem] ${isToday ? 'font-bold text-orange' : 'text-ink-light'}`}
              >
                {Number(day.slice(-2))}
              </span>
              {calView === 'guest' ? (
                <>
                  {dayActive.length > 0 ? (
                    <span className="mt-0.5 font-bold text-orange leading-none">
                      <span className="text-[0.72rem] md:hidden">{headCount}名</span>
                      <span className="hidden text-[0.68rem] md:inline">
                        {dayActive.length}組{headCount}名
                      </span>
                    </span>
                  ) : null}
                  {whole ? <span className="mt-0.5 text-[0.56rem] text-wood">貸切</span> : null}
                </>
              ) : plans.length > 0 ? (
                <span className="mt-0.5 flex flex-wrap justify-center gap-0.5">
                  {plans.slice(0, 3).map((plan) => {
                    const member = plan.staff_id ? staffById.get(plan.staff_id) : undefined;
                    return (
                      <span
                        key={plan.id}
                        className="inline-block rounded px-1 font-bold text-[0.58rem] text-white leading-tight"
                        style={{ backgroundColor: member?.accent ?? '#8a8a8a' }}
                      >
                        {(member?.name ?? '?').slice(0, 1)}
                      </span>
                    );
                  })}
                  {plans.length > 3 ? (
                    <span className="text-[0.54rem] text-ink-mute">+{plans.length - 3}</span>
                  ) : null}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {/* Owner bulk tools for the rota. */}
      {calView === 'shift' && isOwner ? (
        <div className="mt-3">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setRangeOpen((open) => !open);
                if (!rangeStart) setRangeStart(selectedDay ?? shiftDate());
                if (!rangeEnd) setRangeEnd(selectedDay ?? shiftDate());
              }}
              className="min-h-[40px] rounded-full border border-line px-4 font-bold text-[0.8rem] text-ink-light"
            >
              期間でまとめて入力
            </button>
            <button
              type="button"
              onClick={doCopyWeek}
              disabled={!selectedDay || busy}
              className="min-h-[40px] rounded-full border border-line px-4 font-bold text-[0.8rem] text-ink-light disabled:opacity-40"
            >
              前週をコピー
            </button>
          </div>
          {rangeOpen ? (
            <div className="mt-2 rounded-kb border border-line p-3">
              <div className="mb-2 text-[0.78rem] text-ink-light">
                期間とスタッフを選んで、まとめて割り当て
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="date"
                  className={FIELD}
                  value={rangeStart}
                  onChange={(event) => setRangeStart(event.target.value)}
                />
                <span className="text-ink-mute">〜</span>
                <input
                  type="date"
                  className={FIELD}
                  value={rangeEnd}
                  onChange={(event) => setRangeEnd(event.target.value)}
                />
                <select
                  className={FIELD}
                  value={rangeStaff}
                  onChange={(event) => setRangeStaff(event.target.value)}
                >
                  <option value="">スタッフを選択</option>
                  {rosterStaff.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={doRange}
                  disabled={!rangeStart || !rangeEnd || !rangeStaff || busy}
                  className="min-h-[44px] rounded-full bg-orange px-5 font-bold text-[0.85rem] text-onaccent disabled:opacity-40"
                >
                  割り当て
                </button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="mt-4">
        {!selectedDay ? (
          <p className="px-1 text-center text-[0.82rem] text-ink-mute">
            {calView === 'guest'
              ? '日付をタップすると、その日のゲストが表示されます。'
              : '日付をタップすると、その日のシフトが表示されます。'}
          </p>
        ) : calView === 'guest' ? (
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
          </>
        ) : (
          <>
            <SectionLabel>{formatStayDate(selectedDay)} のシフト</SectionLabel>
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
                      {isOwner ? (
                        <button
                          type="button"
                          aria-label="削除"
                          onClick={() => removeShiftPlan(plan.id)}
                          className="grid h-9 w-9 place-items-center text-ink-mute"
                        >
                          <Trash2 size={16} />
                        </button>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
            {isOwner ? (
              <div className="rounded-kb border border-line p-3">
                <div className="mb-2 text-[0.78rem] text-ink-light">この日に追加</div>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    className={FIELD}
                    value={addStaff}
                    onChange={(event) => setAddStaff(event.target.value)}
                  >
                    <option value="">スタッフを選択</option>
                    {rosterStaff.map((member) => (
                      <option key={member.id} value={member.id}>
                        {member.name}
                      </option>
                    ))}
                  </select>
                  <input
                    className={`flex-1 ${FIELD}`}
                    placeholder="早番・遅番など（任意）"
                    value={addLabel}
                    onChange={(event) => setAddLabel(event.target.value)}
                  />
                  <button
                    type="button"
                    onClick={doAdd}
                    disabled={!addStaff || busy}
                    className="min-h-[44px] rounded-full bg-orange px-5 font-bold text-[0.85rem] text-onaccent disabled:opacity-40"
                  >
                    追加
                  </button>
                </div>
              </div>
            ) : null}
          </>
        )}
      </div>
    </>
  );
}
