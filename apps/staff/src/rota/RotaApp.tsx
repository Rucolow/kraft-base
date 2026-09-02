import { useCallback, useEffect, useState } from 'react';
import { formatClock, nowIso, shiftDate } from '../lib/date';
import { addMonth, monthDays, monthLabel, monthLeadingBlanks } from '../lib/month';

// R9: the login-free shift page staff open from their phone's home screen.
// Reads a per-staff token from ?t= (remembered locally so the home-screen
// shortcut keeps working), calls the public rota_feed RPC directly, and renders
// the house rota. No PowerSync, no auth, no guest data — by design.

const TOKEN_KEY = 'kb-rota-token';
const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

interface RotaRow {
  date: string;
  staff_name: string;
  accent: string | null;
  label: string | null;
}

function readToken(): string | null {
  const fromUrl = new URLSearchParams(window.location.search).get('t');
  if (fromUrl) {
    try {
      localStorage.setItem(TOKEN_KEY, fromUrl);
    } catch {
      /* private mode etc. — the URL still carries it */
    }
    return fromUrl;
  }
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

async function fetchRota(token: string, ym: string): Promise<RotaRow[]> {
  if (!SUPABASE_URL || !ANON_KEY) {
    throw new Error('not configured');
  }
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/rota_feed`, {
    method: 'POST',
    headers: {
      apikey: ANON_KEY,
      Authorization: `Bearer ${ANON_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ p_token: token, p_from: `${ym}-01`, p_to: `${ym}-31` }),
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  return (await res.json()) as RotaRow[];
}

export function RotaApp() {
  const [token] = useState(readToken);
  const [month, setMonth] = useState(() => shiftDate().slice(0, 7));
  const [rows, setRows] = useState<RotaRow[]>([]);
  const [state, setState] = useState<'loading' | 'ok' | 'error'>('loading');
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) {
      return;
    }
    setState('loading');
    try {
      setRows(await fetchRota(token, month));
      setUpdatedAt(nowIso());
      setState('ok');
    } catch (error) {
      console.error('rota load failed', error);
      setState('error');
    }
  }, [token, month]);

  useEffect(() => {
    load();
  }, [load]);

  // Reopening from the home screen (or switching back to the tab) is the
  // moment staff want "the latest" — refetch on visibility/focus.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        load();
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', load);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', load);
    };
  }, [load]);

  if (!token) {
    return (
      <Shell>
        <p className="mt-6 font-bold text-[1.05rem]">このリンクは無効です</p>
        <p className="mt-2 text-[0.88rem] text-ink-light">
          オーナーから新しいシフト表のリンクをもらってください。
        </p>
      </Shell>
    );
  }

  const byDay = new Map<string, RotaRow[]>();
  for (const row of rows) {
    const list = byDay.get(row.date);
    if (list) {
      list.push(row);
    } else {
      byDay.set(row.date, [row]);
    }
  }
  const today = shiftDate();
  const selectedRows = selected ? (byDay.get(selected) ?? []) : [];

  return (
    <Shell>
      <div className="mt-4 flex items-center justify-between">
        <button
          type="button"
          aria-label="前の月"
          onClick={() => {
            setMonth((m) => addMonth(m, -1));
            setSelected(null);
          }}
          className="grid h-11 w-11 place-items-center rounded-full border border-line text-ink-light"
        >
          ‹
        </button>
        <div className="font-bold text-[1.1rem] tabular-nums">{monthLabel(month)}</div>
        <button
          type="button"
          aria-label="次の月"
          onClick={() => {
            setMonth((m) => addMonth(m, 1));
            setSelected(null);
          }}
          className="grid h-11 w-11 place-items-center rounded-full border border-line text-ink-light"
        >
          ›
        </button>
      </div>

      <div className="mt-3 grid grid-cols-7 gap-1 text-center text-[0.66rem] text-ink-mute">
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
          const plans = byDay.get(day) ?? [];
          const isToday = day === today;
          const isSel = day === selected;
          return (
            <button
              key={day}
              type="button"
              data-day={day}
              onClick={() => setSelected(day)}
              className={`flex min-h-[58px] flex-col items-center rounded-[10px] border px-0.5 pt-1 pb-0.5 ${
                isSel ? 'border-orange bg-orange/15' : 'border-line bg-paper'
              }`}
            >
              <span
                className={`text-[0.7rem] ${isToday ? 'font-bold text-orange' : 'text-ink-light'}`}
              >
                {Number(day.slice(-2))}
              </span>
              {plans.length > 0 ? (
                <span className="mt-0.5 flex flex-wrap justify-center gap-0.5">
                  {plans.slice(0, 3).map((plan, index) => (
                    <span
                      // biome-ignore lint/suspicious/noArrayIndexKey: display-only chips
                      key={index}
                      className="inline-block rounded px-1 font-bold text-[0.6rem] text-white leading-tight"
                      style={{ backgroundColor: plan.accent ?? '#8a8a8a' }}
                    >
                      {plan.staff_name.slice(0, 1)}
                    </span>
                  ))}
                  {plans.length > 3 ? (
                    <span className="text-[0.54rem] text-ink-mute">+{plans.length - 3}</span>
                  ) : null}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      <div className="mt-4">
        {state === 'error' ? (
          <div className="rounded-[13px] border border-orange-deep/40 bg-orange/[0.07] px-3.5 py-3 text-[0.84rem]">
            シフト表を読み込めませんでした。電波の良いところで
            <button type="button" onClick={load} className="ml-1 underline">
              再読み込み
            </button>
          </div>
        ) : null}
        {selected ? (
          <>
            <div className="mb-1 font-bold text-[0.95rem]">
              {Number(selected.slice(5, 7))}/{Number(selected.slice(8, 10))} のシフト
            </div>
            {selectedRows.length === 0 ? (
              <p className="text-[0.84rem] text-ink-mute">この日の割り当てはありません。</p>
            ) : (
              selectedRows.map((row, index) => (
                <div
                  // biome-ignore lint/suspicious/noArrayIndexKey: display-only rows
                  key={index}
                  className="mb-2 flex items-center gap-2.5 rounded-[12px] border border-line bg-paper px-3 py-2.5"
                >
                  <span
                    className="h-3 w-3 shrink-0 rounded-full"
                    style={{ backgroundColor: row.accent ?? '#8a8a8a' }}
                  />
                  <span className="flex-1 font-bold text-[0.95rem]">{row.staff_name}</span>
                  {row.label ? (
                    <span className="rounded-full bg-cream-dark px-2.5 py-[3px] text-[0.72rem] text-ink-light">
                      {row.label}
                    </span>
                  ) : null}
                </div>
              ))
            )}
          </>
        ) : (
          <p className="text-center text-[0.8rem] text-ink-mute">
            日付をタップすると、その日のシフトが表示されます。
          </p>
        )}
      </div>

      <p className="mt-6 text-center text-[0.66rem] text-ink-mute">
        {state === 'loading' ? '読み込み中…' : updatedAt ? `更新 ${formatClock(updatedAt)}` : ''}
        <span className="ml-2">開くたびに最新のシフトを取得します</span>
      </p>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto min-h-dvh max-w-[480px] bg-paper px-5 pt-8 pb-10 text-ink">
      <div className="font-heading text-[1.3rem] tracking-[0.22em] text-orange">KRAFT BASE</div>
      <div className="text-[0.8rem] text-ink-light">シフト表</div>
      {children}
    </div>
  );
}
