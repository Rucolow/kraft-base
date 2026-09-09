import { Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { MonthGrid, ShiftChips, UnavailMarks } from '../components/MonthGrid';
import { RotaShare } from '../components/RotaShare';
import { Badge, EmptyState, Screen, SectionLabel } from '../components/ui';
import { useShiftPlansInMonth, useStaff, useUnavailableInMonth } from '../data/queries';
import { formatStayDate, shiftDate } from '../lib/date';
import { addDays, addMonth, dateRange } from '../lib/month';
import type { ShiftPlanRow, StaffRow } from '../lib/powersync/schema';
import { isRosterMember, useSession } from '../lib/session';
import { isUnavailable, splitByAvailability, unavailableByDay } from '../lib/shiftAvail';
import {
  addShiftPlan,
  addShiftPlanRange,
  copyPrevWeek,
  planCopyPrevWeek,
  removeShiftPlan,
} from '../lib/shiftPlanOps';
import { toggleUnavailable, unavailableBetween } from '../lib/shiftUnavailableOps';
import { WorkTimePanel } from './WorkTime';

// R11: the one place shifts are handled. 休み希望 (everyone registers their own
// 「入れない日」), シフト作成 (the owner's rota tools, moved off the guest
// calendar) and 勤務 (the payroll view that used to live at /worktime).
//
// Who a request belongs to is decided by currentStaff, not by the auth row — the
// shared reception iPad signs in as the device account (same trust model as
// shift_session / migration 0025).

type Tab = 'avail' | 'plan' | 'work';

const FIELD =
  'min-h-[44px] rounded-[10px] border border-line bg-cream px-3 py-2 text-[0.9rem] text-ink outline-none focus:border-orange-light';

// '2026-09-12' -> '9/12', for the compact 除外 list inside a confirm dialog.
function shortDate(date: string): string {
  const [, month, day] = date.split('-');
  return `${Number(month)}/${Number(day)}`;
}

function bucketPlans(rows: ShiftPlanRow[]): Map<string, ShiftPlanRow[]> {
  const map = new Map<string, ShiftPlanRow[]>();
  for (const row of rows) {
    const key = row.date ?? '';
    const arr = map.get(key);
    if (arr) {
      arr.push(row);
    } else {
      map.set(key, [row]);
    }
  }
  return map;
}

export function Shifts() {
  const { isOwner, currentStaff } = useSession();
  const [searchParams, setSearchParams] = useSearchParams();
  const [month, setMonth] = useState(() => shiftDate().slice(0, 7));
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const { data: monthPlans } = useShiftPlansInMonth(month);
  const { data: monthUnavail } = useUnavailableInMonth(month);
  const { data: staff } = useStaff();

  // Owner rota tools (moved from GuestCalendar, behaviour unchanged apart from
  // the availability skipping).
  const [addStaff, setAddStaff] = useState('');
  const [addLabel, setAddLabel] = useState('');
  const [rangeOpen, setRangeOpen] = useState(false);
  const [rangeStart, setRangeStart] = useState('');
  const [rangeEnd, setRangeEnd] = useState('');
  const [rangeStaff, setRangeStaff] = useState('');
  const [busy, setBusy] = useState(false);

  // The owner-only tabs never render for staff, so a hand-typed ?tab=plan cannot
  // reach the rota tools either.
  const requested = searchParams.get('tab');
  const tab: Tab = !isOwner
    ? 'avail'
    : requested === 'plan' || requested === 'work'
      ? requested
      : 'avail';
  const setTab = (next: Tab) => {
    setSearchParams(next === 'avail' ? {} : { tab: next }, { replace: true });
  };

  const byDayPlans = bucketPlans(monthPlans);
  const unavailable = unavailableByDay(monthUnavail);
  const staffById = new Map<string, StaffRow>(staff.map((member) => [member.id, member]));
  const rosterStaff = staff.filter(isRosterMember);
  const today = shiftDate();
  const myId = currentStaff?.id ?? null;

  const selectedPlans = selectedDay ? (byDayPlans.get(selectedDay) ?? []) : [];
  // Roster order (staff arrives ORDER BY role, name), not the row insertion order.
  const selectedUnavail = selectedDay
    ? rosterStaff.filter((member) => isUnavailable(unavailable, selectedDay, member.id))
    : [];

  const goMonth = (delta: number) => {
    setMonth((current) => addMonth(current, delta));
    setSelectedDay(null);
  };

  // 休み希望: one tap both selects the day and toggles MY request. Past days stay
  // selectable (to read the day) but are not editable.
  async function onAvailDay(day: string) {
    setSelectedDay(day);
    if (!myId || day < today || busy) {
      return;
    }
    setBusy(true);
    try {
      await toggleUnavailable({ date: day, staffId: myId, createdBy: myId });
    } finally {
      setBusy(false);
    }
  }

  // try/finally so a rejected write never leaves `busy` stuck true (which would
  // wedge every edit button until the component remounts).
  async function doAdd() {
    if (!selectedDay || !addStaff || busy) {
      return;
    }
    if (
      isUnavailable(unavailable, selectedDay, addStaff) &&
      !window.confirm('この日は入れない日として登録されています。割り当てますか？')
    ) {
      return;
    }
    setBusy(true);
    try {
      await addShiftPlan({
        date: selectedDay,
        staffId: addStaff,
        label: addLabel || null,
        createdBy: myId,
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
    const [start, end] = rangeStart <= rangeEnd ? [rangeStart, rangeEnd] : [rangeEnd, rangeStart];
    // Read the window from the database, not the month grid: a range may run past
    // the displayed month, whose watched query would not know about it.
    const { skipped } = splitByAvailability(
      dateRange(start, end),
      rangeStaff,
      await unavailableBetween(start, end),
    );
    if (
      skipped.length > 0 &&
      !window.confirm(
        `入れない日として登録されている${skipped.length}日を除外して割り当てます。\n除外: ${skipped
          .map(shortDate)
          .join(', ')}\n続けますか？`,
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      // The range tool has no label field, so assign unlabeled (don't leak the
      // add-form's label); the owner can label individual days afterward.
      await addShiftPlanRange({
        start,
        end,
        staffId: rangeStaff,
        label: null,
        createdBy: myId,
        skipDates: new Set(skipped),
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
      // Plan first so the confirm can name the days it will drop; the write then
      // applies the same rule. The source week is read from the database (not the
      // month window), so it may cross a month boundary.
      const weekUnavail = await unavailableBetween(selectedDay, addDays(selectedDay, 6));
      const { skipped } = await planCopyPrevWeek(selectedDay, weekUnavail);
      if (
        skipped.length > 0 &&
        !window.confirm(
          `前週のコピーで、入れない日として登録されている${skipped.length}日を除外します。\n除外: ${skipped
            .map(shortDate)
            .join(', ')}\n続けますか？`,
        )
      ) {
        return;
      }
      await copyPrevWeek(selectedDay, myId, weekUnavail);
    } finally {
      setBusy(false);
    }
  }

  const tabs: [Tab, string][] = isOwner
    ? [
        ['avail', '休み希望'],
        ['plan', 'シフト作成'],
        ['work', '勤務'],
      ]
    : [['avail', '休み希望']];

  const renderDay = (day: string) => {
    const all = unavailable.get(day) ?? [];
    return (
      <>
        <ShiftChips plans={byDayPlans.get(day) ?? []} staffById={staffById} />
        <UnavailMarks
          mine={isUnavailable(unavailable, day, myId)}
          others={all.filter((id) => id !== myId).length}
        />
      </>
    );
  };

  const dayAttrs = (day: string): Record<string, string> | undefined => {
    const mine = isUnavailable(unavailable, day, myId);
    const attrs: Record<string, string> = {};
    if (mine) {
      attrs['data-unavail'] = 'me';
    }
    if (tab === 'avail') {
      attrs['aria-pressed'] = mine ? 'true' : 'false';
    }
    return Object.keys(attrs).length > 0 ? attrs : undefined;
  };

  return (
    <Screen>
      <div className="mb-4 flex flex-wrap gap-2">
        {tabs.map(([key, label]) => (
          <button
            key={key}
            type="button"
            aria-pressed={tab === key}
            onClick={() => setTab(key)}
            className={`flex min-h-[40px] items-center rounded-full border px-4 font-bold text-[0.84rem] ${
              tab === key ? 'border-orange bg-orange/15 text-orange' : 'border-line text-ink-light'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'work' ? (
        <WorkTimePanel />
      ) : (
        <>
          {tab === 'avail' ? (
            <p className="mb-2 px-0.5 text-[0.82rem] text-ink-light">
              出勤できない日をタップして登録（自分の分だけ）
            </p>
          ) : null}

          <MonthGrid
            month={month}
            onMonth={goMonth}
            selected={selectedDay}
            onSelect={tab === 'avail' ? onAvailDay : setSelectedDay}
            renderDay={renderDay}
            dayAttrs={dayAttrs}
          />

          {!selectedDay ? (
            <p className="mt-4 px-1 text-center text-[0.82rem] text-ink-mute">
              {tab === 'avail'
                ? '日付をタップすると、自分の「入れない日」が登録され、その日の予定が下に表示されます。'
                : '日付をタップすると、その日の割り当てを編集できます。'}
            </p>
          ) : (
            <div className="mt-4">
              <SectionLabel>{formatStayDate(selectedDay)}</SectionLabel>
              <div className="rounded-kb border border-line bg-paper px-3 py-2.5 text-[0.86rem]">
                <div className="text-ink">
                  入れない:{' '}
                  {selectedUnavail.length === 0 ? (
                    <span className="text-ink-mute">なし</span>
                  ) : (
                    <span className="font-bold text-orange">
                      {selectedUnavail.map((member) => member.name).join(', ')}
                    </span>
                  )}
                </div>
                {tab === 'avail' ? (
                  <div className="mt-1 text-ink-light">
                    この日のシフト:{' '}
                    {selectedPlans.length === 0 ? (
                      <span className="text-ink-mute">なし</span>
                    ) : (
                      selectedPlans
                        .map((plan) => {
                          const name =
                            (plan.staff_id ? staffById.get(plan.staff_id)?.name : null) ??
                            '不明なスタッフ';
                          return plan.label ? `${name}（${plan.label}）` : name;
                        })
                        .join(', ')
                    )}
                  </div>
                ) : null}
              </div>
              {tab === 'avail' && selectedDay < today ? (
                <p className="mt-2 px-1 text-[0.76rem] text-ink-mute">過ぎた日は変更できません。</p>
              ) : null}
            </div>
          )}

          {/* Owner bulk tools for the rota. Kept ABOVE the per-day assignment
              editor, as on the old guest calendar. */}
          {tab === 'plan' ? (
            <div className="mt-3">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setRangeOpen((open) => !open);
                    if (!rangeStart) setRangeStart(selectedDay ?? today);
                    if (!rangeEnd) setRangeEnd(selectedDay ?? today);
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
              <RotaShare />
              {rangeOpen ? (
                <div className="mt-2 rounded-kb border border-line p-3">
                  <div className="mb-2 text-[0.78rem] text-ink-light">
                    期間とスタッフを選んで、まとめて割り当て（入れない日は除外します）
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

          {tab === 'plan' && selectedDay ? (
            <div className="mt-2">
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
                        <button
                          type="button"
                          aria-label="削除"
                          onClick={() => {
                            if (
                              window.confirm(
                                `${member?.name ?? 'このスタッフ'} のシフトを削除しますか？`,
                              )
                            ) {
                              removeShiftPlan(plan.id);
                            }
                          }}
                          className="grid h-9 w-9 place-items-center text-ink-mute"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
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
                        {isUnavailable(unavailable, selectedDay, member.id)
                          ? `${member.name}（入れない）`
                          : member.name}
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
            </div>
          ) : null}
        </>
      )}
    </Screen>
  );
}
