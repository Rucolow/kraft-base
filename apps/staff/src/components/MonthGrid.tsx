import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';
import { shiftDate } from '../lib/date';
import { monthDays, monthLabel, monthLeadingBlanks } from '../lib/month';
import type { ShiftPlanRow, StaffRow } from '../lib/powersync/schema';

// Month calendar shared by the guest calendar (R6) and the shift screen (R11):
// month nav, Sunday-first weekday header, `data-day` cells (the stable e2e hook —
// cell text concatenates a day number with counts, so text matching is ambiguous)
// and the today highlight. Everything below the day number is the caller's.

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

export function MonthGrid({
  month,
  onMonth,
  selected,
  onSelect,
  renderDay,
  dayTone,
  dayAttrs,
}: {
  month: string;
  onMonth: (delta: number) => void;
  selected: string | null;
  onSelect: (day: string) => void;
  renderDay: (day: string) => ReactNode;
  // Extra border/background classes for a day that is neither selected nor plain.
  dayTone?: (day: string) => string | null;
  // Extra attributes on the cell button (aria-pressed, data-* hooks).
  dayAttrs?: (day: string) => Record<string, string> | undefined;
}) {
  const today = shiftDate();
  return (
    <>
      <div className="mb-2 flex items-center justify-between">
        <button
          type="button"
          aria-label="前の月"
          onClick={() => onMonth(-1)}
          className="grid h-10 w-10 place-items-center rounded-full border border-line text-ink-light"
        >
          <ChevronLeft size={20} />
        </button>
        <div className="font-bold text-[1.05rem] tabular-nums">{monthLabel(month)}</div>
        <button
          type="button"
          aria-label="次の月"
          onClick={() => onMonth(1)}
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
          const tone = dayTone?.(day) ?? null;
          return (
            <button
              key={day}
              type="button"
              data-day={day}
              {...(dayAttrs?.(day) ?? {})}
              onClick={() => onSelect(day)}
              className={`flex min-h-[58px] flex-col items-center rounded-[10px] border px-0.5 pt-1 pb-0.5 ${
                day === selected ? 'border-orange bg-orange/15' : (tone ?? 'border-line bg-paper')
              }`}
            >
              <span
                className={`text-[0.68rem] ${day === today ? 'font-bold text-orange' : 'text-ink-light'}`}
              >
                {Number(day.slice(-2))}
              </span>
              {renderDay(day)}
            </button>
          );
        })}
      </div>
    </>
  );
}

// One day's rota as staff-accent initial chips (max 3, then "+n"). Shared so the
// guest calendar and the shift screen never drift apart.
export function ShiftChips({
  plans,
  staffById,
}: {
  plans: ShiftPlanRow[];
  staffById: Map<string, StaffRow>;
}) {
  if (plans.length === 0) {
    return null;
  }
  return (
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
  );
}

// 「入れない日」 marks for one cell: the current staff's own request reads big and
// orange (it is the thing they just tapped), everyone else's is a quiet count so
// the rota chips above keep their three slots.
export function UnavailMarks({ mine, others }: { mine: boolean; others: number }) {
  if (!mine && others === 0) {
    return null;
  }
  return (
    <span className="mt-0.5 flex items-center gap-0.5 leading-none">
      {mine ? <span className="font-bold text-[0.85rem] text-orange">×</span> : null}
      {others > 0 ? <span className="text-[0.56rem] text-ink-mute">×{others}</span> : null}
    </span>
  );
}
