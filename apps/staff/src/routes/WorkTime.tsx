import { useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { EmptyState, Screen, SectionLabel } from '../components/ui';
import { useShiftSessions, useStaff } from '../data/queries';
import { formatClock, jstDate } from '../lib/date';
import { useSession } from '../lib/session';

const JST = 'Asia/Tokyo';

function ymOf(iso: string): string {
  return jstDate(new Date(iso)).slice(0, 7);
}
function dayOf(iso: string): string {
  return jstDate(new Date(iso));
}
function parseYm(ym: string): [number, number] {
  const parts = ym.split('-');
  return [Number(parts[0] ?? '0'), Number(parts[1] ?? '1')];
}
function addMonth(ym: string, delta: number): string {
  const [y, m] = parseYm(ym);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}
function monthLabel(ym: string): string {
  const [y, m] = parseYm(ym);
  return `${y}年${m}月`;
}
function durLabel(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h}時間${m}分` : `${m}分`;
}
function dayLabel(day: string): string {
  return new Date(`${day}T00:00:00+09:00`).toLocaleDateString('ja-JP', {
    timeZone: JST,
    month: 'numeric',
    day: 'numeric',
    weekday: 'short',
  });
}

export function WorkTime() {
  const { isOwner } = useSession();
  const { data: sessions } = useShiftSessions();
  const { data: staff } = useStaff();
  const [month, setMonth] = useState(() => jstDate().slice(0, 7));

  const nameOf = useMemo(() => {
    const map = new Map(staff.map((s) => [s.id, s.name]));
    return (id: string | null) => (id ? (map.get(id) ?? '不明') : '不明');
  }, [staff]);

  const now = Date.now();
  const rows = sessions
    .filter((s) => s.started_at && ymOf(s.started_at) === month)
    .map((s) => {
      const startIso = s.started_at as string;
      const start = new Date(startIso).getTime();
      const end = s.ended_at ? new Date(s.ended_at).getTime() : now;
      return {
        id: s.id,
        staffId: s.staff_id ?? '',
        name: nameOf(s.staff_id),
        day: dayOf(startIso),
        startIso,
        endIso: s.ended_at,
        minutes: Math.max(0, Math.round((end - start) / 60000)),
        ongoing: !s.ended_at,
      };
    });

  const totalsMap = new Map<string, { name: string; minutes: number; count: number }>();
  for (const r of rows) {
    const cur = totalsMap.get(r.staffId) ?? { name: r.name, minutes: 0, count: 0 };
    cur.minutes += r.minutes;
    cur.count += 1;
    totalsMap.set(r.staffId, cur);
  }
  const totals = [...totalsMap.values()].sort((a, b) => b.minutes - a.minutes);

  if (!isOwner) {
    return <Navigate to="/" replace />;
  }

  const btn =
    'grid h-10 w-10 place-items-center rounded-full border border-line bg-paper text-ink-light';

  return (
    <Screen>
      <div className="mb-4 flex items-center justify-between">
        <button
          type="button"
          aria-label="前の月"
          onClick={() => setMonth(addMonth(month, -1))}
          className={btn}
        >
          ◀
        </button>
        <div className="font-bold text-[1.05rem] tabular-nums">{monthLabel(month)}</div>
        <button
          type="button"
          aria-label="次の月"
          onClick={() => setMonth(addMonth(month, 1))}
          className={btn}
        >
          ▶
        </button>
      </div>

      <SectionLabel>スタッフ別 合計（給与計算用）</SectionLabel>
      {totals.length === 0 ? (
        <EmptyState>この月の勤務記録はありません。</EmptyState>
      ) : (
        <div className="mb-5 overflow-hidden rounded-kb border border-line">
          {totals.map((t) => (
            <div
              key={t.name}
              className="flex items-center justify-between gap-3 border-line border-b bg-paper px-4 py-3 last:border-none"
            >
              <span className="font-bold text-[0.96rem]">{t.name}</span>
              <span className="text-right">
                <span className="font-bold text-[0.98rem] text-orange tabular-nums">
                  {durLabel(t.minutes)}
                </span>
                <span className="ml-2 text-[0.74rem] text-ink-mute tabular-nums">{t.count}回</span>
              </span>
            </div>
          ))}
        </div>
      )}

      <SectionLabel>勤務ログ</SectionLabel>
      {rows.length === 0 ? (
        <EmptyState>記録はありません。</EmptyState>
      ) : (
        <div className="overflow-hidden rounded-kb border border-line">
          {rows.map((r) => (
            <div
              key={r.id}
              className="grid grid-cols-[auto_1fr_auto] items-center gap-x-3 border-line border-b bg-paper px-3 py-2.5 text-[0.86rem] last:border-none"
            >
              <span className="text-ink-light text-[0.76rem] tabular-nums">{dayLabel(r.day)}</span>
              <span className="truncate font-bold">{r.name}</span>
              <span className="text-right tabular-nums">
                <span className="text-ink-light">
                  {formatClock(r.startIso)}–{r.endIso ? formatClock(r.endIso) : '…'}
                </span>
                <span className={`ml-2 font-bold ${r.ongoing ? 'text-orange' : 'text-ink'}`}>
                  {r.ongoing ? '勤務中' : durLabel(r.minutes)}
                </span>
              </span>
            </div>
          ))}
        </div>
      )}

      <p className="mt-4 px-1 text-[0.74rem] text-ink-mute">
        ※
        受付iPadで名前をタップしてから、次の人がタップする（または翌朝4時）までを1回の勤務として記録しています。あくまで目安です。
      </p>
    </Screen>
  );
}
