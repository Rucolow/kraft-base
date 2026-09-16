import { Plus, Trash2 } from 'lucide-react';
import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BackButton, Badge, Card, EmptyState, Screen, SectionLabel } from '../components/ui';
import { useCashExpensesInMonth } from '../data/queries';
import { formatYen, monthKey, sumPersonal, sumYen } from '../lib/cash';
import { formatStayDate, jstDate, nowIso } from '../lib/date';
import { deleteRow, insertRow, updateRow, uuid } from '../lib/db';
import { addMonth, monthLabel } from '../lib/month';
import { useSession } from '../lib/session';

const PAID_FROM = [
  { key: 'house', label: '宿の現金' },
  { key: 'personal', label: '立替' },
] as const;

type PaidFrom = (typeof PAID_FROM)[number]['key'];

interface Draft {
  date: string;
  item: string;
  amount: string;
  paidFrom: PaidFrom;
  note: string;
}

const emptyDraft = (): Draft => ({
  // The ledger keys off the CALENDAR date (receipts), not the 04:00 shift-day.
  date: jstDate(),
  item: '',
  amount: '',
  paidFrom: 'house',
  note: '',
});

// '-500' → -500. Anything that isn't a usable amount (including 0, which has no
// meaning here and is rejected by the CHECK server-side) comes back as null.
function parseAmount(value: string): number | null {
  const parsed = Number.parseInt(value.replace(/[^\d-]/g, ''), 10);
  return Number.isFinite(parsed) && parsed !== 0 ? parsed : null;
}

const fieldClass =
  'min-h-[44px] w-full rounded-[11px] border border-line bg-cream px-3 py-2.5 text-base outline-none focus:border-orange-light';

function PaidFromChips({
  value,
  onChange,
}: {
  value: PaidFrom;
  onChange: (next: PaidFrom) => void;
}) {
  return (
    <div className="mb-2 flex gap-2">
      {PAID_FROM.map((option) => (
        <button
          key={option.key}
          type="button"
          onClick={() => onChange(option.key)}
          className={`min-h-[44px] flex-1 rounded-[11px] border text-[0.84rem] ${value === option.key ? 'border-orange bg-orange/15 text-orange' : 'border-line text-ink-light'}`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function Cash() {
  const navigate = useNavigate();
  const { staff, currentStaff, isOwner } = useSession();
  const [month, setMonth] = useState(() => monthKey(jstDate()));
  const { data: rows } = useCashExpensesInMonth(month);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [edit, setEdit] = useState<Draft>(emptyDraft);
  const adding = useRef(false);

  const total = sumYen(rows);
  const personal = sumPersonal(rows);

  async function add() {
    const amount = parseAmount(draft.amount);
    if (!draft.item.trim() || amount === null || adding.current) {
      return;
    }
    adding.current = true;
    try {
      await insertRow('cash_expense', {
        id: uuid(),
        date: draft.date,
        item: draft.item.trim(),
        amount_yen: amount,
        paid_from: draft.paidFrom,
        created_by: currentStaff?.id ?? null,
        note: draft.note.trim() || null,
        created_at: nowIso(),
      });
      setDraft(emptyDraft());
    } finally {
      adding.current = false;
    }
  }

  // Corrections are open to everyone (RLS: update = org member): a typo noticed
  // ten seconds later should not need the owner.
  function openEdit(row: {
    id: string;
    date: string | null;
    item: string | null;
    amount_yen: number | null;
    paid_from: string | null;
    note: string | null;
  }) {
    setEditingId(row.id);
    setEdit({
      date: row.date ?? jstDate(),
      item: row.item ?? '',
      amount: String(row.amount_yen ?? ''),
      paidFrom: row.paid_from === 'personal' ? 'personal' : 'house',
      note: row.note ?? '',
    });
  }

  async function saveEdit() {
    const amount = parseAmount(edit.amount);
    if (!editingId || !edit.item.trim() || amount === null) {
      return;
    }
    await updateRow('cash_expense', editingId, {
      date: edit.date,
      item: edit.item.trim(),
      amount_yen: amount,
      paid_from: edit.paidFrom,
      note: edit.note.trim() || null,
    });
    setEditingId(null);
  }

  async function remove(id: string, item: string | null) {
    if (!window.confirm(`「${item ?? ''}」を削除しますか？`)) {
      return;
    }
    await deleteRow('cash_expense', id);
    setEditingId((prev) => (prev === id ? null : prev));
  }

  const navBtn =
    'grid h-10 w-10 place-items-center rounded-full border border-line bg-paper text-ink-light';

  return (
    <Screen>
      <BackButton onClick={() => navigate('/records')}>台帳</BackButton>

      <SectionLabel>買ったものを記録</SectionLabel>
      <input
        type="date"
        aria-label="日付"
        className={`${fieldClass} mb-2`}
        value={draft.date}
        onChange={(event) => setDraft((prev) => ({ ...prev, date: event.target.value }))}
      />
      <input
        className={`${fieldClass} mb-2`}
        placeholder="品目（例: 洗剤・ゴミ袋）"
        value={draft.item}
        onChange={(event) => setDraft((prev) => ({ ...prev, item: event.target.value }))}
      />
      <input
        type="number"
        inputMode="numeric"
        aria-label="金額"
        className={`${fieldClass} mb-2`}
        placeholder="金額（返品・返金は −1200 のように）"
        value={draft.amount}
        onChange={(event) => setDraft((prev) => ({ ...prev, amount: event.target.value }))}
      />
      <PaidFromChips
        value={draft.paidFrom}
        onChange={(next) => setDraft((prev) => ({ ...prev, paidFrom: next }))}
      />
      <div className="flex items-center gap-2">
        <input
          className={fieldClass}
          placeholder="メモ（任意）"
          value={draft.note}
          onChange={(event) => setDraft((prev) => ({ ...prev, note: event.target.value }))}
        />
        <button
          type="button"
          aria-label="追加"
          onClick={add}
          className="grid h-[44px] w-[44px] shrink-0 place-items-center rounded-[11px] bg-orange text-onaccent"
        >
          <Plus size={18} />
        </button>
      </div>

      <SectionLabel>出納帳</SectionLabel>
      <div className="mb-3 flex items-center justify-between">
        <button
          type="button"
          aria-label="前の月"
          onClick={() => setMonth(addMonth(month, -1))}
          className={navBtn}
        >
          ‹
        </button>
        <div className="font-bold text-[1.05rem] tabular-nums">{monthLabel(month)}</div>
        <button
          type="button"
          aria-label="次の月"
          onClick={() => setMonth(addMonth(month, 1))}
          className={navBtn}
        >
          ›
        </button>
      </div>

      <Card>
        {rows.length === 0 ? (
          <EmptyState>この月の記録はありません。</EmptyState>
        ) : (
          rows.map((row) => {
            const who = staff.find((member) => member.id === row.created_by) ?? null;
            const amount = row.amount_yen ?? 0;
            if (editingId === row.id) {
              return (
                <div
                  key={row.id}
                  className="border-line border-b border-dashed py-3 last:border-none"
                >
                  <input
                    type="date"
                    aria-label="日付を修正"
                    className={`${fieldClass} mb-2`}
                    value={edit.date}
                    onChange={(event) => setEdit((prev) => ({ ...prev, date: event.target.value }))}
                  />
                  <input
                    aria-label="品目を修正"
                    className={`${fieldClass} mb-2`}
                    value={edit.item}
                    onChange={(event) => setEdit((prev) => ({ ...prev, item: event.target.value }))}
                  />
                  <input
                    type="number"
                    inputMode="numeric"
                    aria-label="金額を修正"
                    className={`${fieldClass} mb-2`}
                    value={edit.amount}
                    onChange={(event) =>
                      setEdit((prev) => ({ ...prev, amount: event.target.value }))
                    }
                  />
                  <PaidFromChips
                    value={edit.paidFrom}
                    onChange={(next) => setEdit((prev) => ({ ...prev, paidFrom: next }))}
                  />
                  <input
                    aria-label="メモを修正"
                    className={`${fieldClass} mb-2`}
                    placeholder="メモ（任意）"
                    value={edit.note}
                    onChange={(event) => setEdit((prev) => ({ ...prev, note: event.target.value }))}
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={saveEdit}
                      className="min-h-[40px] flex-1 rounded-[11px] bg-orange text-[0.86rem] text-onaccent"
                    >
                      保存
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      className="min-h-[40px] flex-1 rounded-[11px] border border-line text-[0.86rem] text-ink-light"
                    >
                      やめる
                    </button>
                  </div>
                </div>
              );
            }
            return (
              <div
                key={row.id}
                className="flex min-h-[44px] items-center gap-2 border-line border-b border-dashed py-2.5 last:border-none"
              >
                <button type="button" onClick={() => openEdit(row)} className="flex-1 text-left">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-[0.9rem]">{row.item}</span>
                    {row.paid_from === 'personal' ? <Badge tone="warn">立替</Badge> : null}
                  </div>
                  <div className="text-[0.74rem] text-ink-light">
                    {row.date ? formatStayDate(row.date) : ''}
                    {who ? ` ・ ${who.name}` : ''}
                    {row.note ? ` ・ ${row.note}` : ''}
                  </div>
                </button>
                <span
                  className={`shrink-0 text-right font-bold text-[0.92rem] tabular-nums ${amount < 0 ? 'text-orange-deep' : 'text-ink'}`}
                >
                  {formatYen(amount)}
                </span>
                {isOwner ? (
                  <button
                    type="button"
                    aria-label="記録を削除"
                    onClick={() => remove(row.id, row.item)}
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-ink-mute"
                  >
                    <Trash2 size={15} />
                  </button>
                ) : null}
              </div>
            );
          })
        )}
      </Card>

      <div className="flex items-center justify-between rounded-kb border border-line bg-cream px-4 py-3">
        <span className="text-[0.86rem] text-ink-light">今月合計</span>
        <span className="font-bold text-[1.05rem] tabular-nums">{formatYen(total)}</span>
      </div>
      <div className="mt-2 flex items-center justify-between rounded-kb border border-line px-4 py-3">
        <span className="text-[0.86rem] text-ink-light">今月の立替</span>
        <span className="font-bold text-[0.98rem] tabular-nums">{formatYen(personal)}</span>
      </div>
    </Screen>
  );
}
