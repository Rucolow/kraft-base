import { AlertTriangle, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useBentoOrdersForDate, useGuestsAroundDate } from '../data/queries';
import {
  hasPartialRefund,
  isCancelledOrder,
  isUnmatched,
  isVisibleOrder,
  mealsBySlug,
  parseItems,
  paymentLabel,
  totalMeals,
} from '../lib/bento';
import { formatStayDate } from '../lib/date';
import { updateRow } from '../lib/db';
import type { BentoOrderRow, GuestRow } from '../lib/powersync/schema';
import { Badge } from './ui';

// Manual matching (docs/plan-bento-integration.md §4): link an order to a guest
// (or exclude it). Writes only guest_id/match — the two columns staff may touch.
async function linkOrder(orderId: string, guestId: string): Promise<void> {
  await updateRow('bento_order', orderId, { guest_id: guestId, match: 'manual' });
}
async function excludeOrder(orderId: string): Promise<void> {
  await updateRow('bento_order', orderId, { guest_id: null, match: 'excluded' });
}
async function unlinkOrder(orderId: string): Promise<void> {
  await updateRow('bento_order', orderId, { guest_id: null, match: 'none' });
}

function OrderRow({
  order,
  guests,
  onPick,
}: {
  order: BentoOrderRow;
  guests: GuestRow[];
  onPick: (order: BentoOrderRow) => void;
}) {
  const cancelled = isCancelledOrder(order);
  const linked = guests.find((guest) => guest.id === order.guest_id) ?? null;
  const tag = paymentLabel(order.payment_method);
  const pending = order.status === 'PENDING';
  return (
    <div className="border-line border-b py-2 last:border-none">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`font-bold text-[0.88rem] ${cancelled ? 'line-through opacity-60' : ''}`}>
          {order.items_label ?? '内容不明'}
        </span>
        {cancelled ? <Badge tone="warn">キャンセル</Badge> : null}
        {pending ? <Badge tone="neutral">決済待ち</Badge> : null}
        {tag && !cancelled ? <Badge tone="wood">{tag}</Badge> : null}
        {hasPartialRefund(order) ? <Badge tone="warn">一部返金あり</Badge> : null}
      </div>
      <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[0.78rem] text-ink-light">
        <span>{order.customer_name || '（氏名なし）'}</span>
        {linked ? (
          <button
            type="button"
            onClick={() => {
              if (window.confirm(`${linked.name} との紐づけを解除しますか？`)) {
                unlinkOrder(order.id);
              }
            }}
            className="rounded-full bg-green-light/20 px-2 py-0.5 text-[0.72rem] text-ink"
          >
            → {linked.name}
          </button>
        ) : order.guest_id ? (
          // Linked, but the guest is outside the ±2day window or was cancelled —
          // still allow undoing the link (confirm-guarded).
          <button
            type="button"
            onClick={() => {
              if (window.confirm('この紐づけを解除しますか？')) {
                unlinkOrder(order.id);
              }
            }}
            className="text-[0.72rem] text-ink-mute underline"
          >
            → 紐づけ済み（解除）
          </button>
        ) : order.match === 'excluded' ? (
          <button
            type="button"
            onClick={() => unlinkOrder(order.id)}
            className="text-[0.72rem] text-ink-mute underline"
          >
            対象外（戻す）
          </button>
        ) : isUnmatched(order) ? (
          <button
            type="button"
            onClick={() => onPick(order)}
            className="rounded-full bg-orange px-2.5 py-0.5 font-bold text-[0.74rem] text-onaccent"
          >
            照合
          </button>
        ) : null}
      </div>
      {order.note ? (
        <div className="mt-1 rounded-[8px] bg-orange/[0.07] px-2 py-1 text-[0.76rem] text-ink">
          📝 {order.note}
        </div>
      ) : null}
    </div>
  );
}

// One-line bento summary for a delivery date, rendered from a pre-fetched orders
// array (no query of its own). Used by the calendar's compact panel and by every
// date group on the "これから先" tab — where the parent fetches all future orders
// in one watch and tick, so this component stays a pure presentation.
// linkedNames: guests linked to this date's orders who are NOT staying this date
// (a multi-night order delivering off the stay date). Their card sits under their
// own stay date, so name them here to keep "who ordered" answerable per delivery.
export function BentoSummaryLine({
  orders,
  now,
  linkedNames,
}: {
  orders: BentoOrderRow[];
  now: Date;
  linkedNames?: string[];
}) {
  const visible = orders.filter((order) => isVisibleOrder(order, now));
  if (visible.length === 0) {
    return null; // no orders — no line, no noise
  }
  const meals = totalMeals(orders);
  const unmatchedCount = orders.filter(isUnmatched).length;
  const cancelledCount = visible.filter((order) => isCancelledOrder(order)).length;
  const summary = mealsBySlug(orders)
    .map((entry) => `${entry.name.replace('弁当', '')}${entry.qty}`)
    .join('・');
  return (
    <div className="mb-2 px-1 text-[0.78rem] text-ink-light">
      🍱 弁当注文 計{meals}食{summary ? `（${summary}）` : ''}
      {cancelledCount > 0 ? (
        <span className="ml-1 text-ink-mute">キャンセル{cancelledCount}件</span>
      ) : null}
      {unmatchedCount > 0 ? (
        <span className="ml-1 text-orange-deep">未照合{unmatchedCount}件</span>
      ) : null}
      {linkedNames && linkedNames.length > 0 ? (
        <span className="ml-1 text-ink">→ {linkedNames.join('・')}</span>
      ) : null}
    </div>
  );
}

// The bento panel for one delivery date. compact: one summary line only (used on
// the calendar); full (Guests today tab): expandable order list + matching.
export function BentoDayPanel({ date, compact = false }: { date: string; compact?: boolean }) {
  const { data: orders } = useBentoOrdersForDate(date);
  const { data: nearbyGuests } = useGuestsAroundDate(date);
  const [open, setOpen] = useState(false);
  const [picking, setPicking] = useState<BentoOrderRow | null>(null);
  // Watched queries only re-emit on data changes; tick every 5 min so the
  // 45-min PENDING→hidden rule takes effect on an idle screen too.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 5 * 60_000);
    return () => clearInterval(timer);
  }, []);

  if (compact) {
    return <BentoSummaryLine orders={orders} now={now} />;
  }

  const visible = orders.filter((order) => isVisibleOrder(order, now));
  const meals = totalMeals(orders);
  const unmatchedCount = orders.filter(isUnmatched).length;
  const cancelledCount = visible.filter((order) => isCancelledOrder(order)).length;

  if (visible.length === 0) {
    return null; // no orders — no panel, no noise
  }

  const summary = mealsBySlug(orders)
    .map((entry) => `${entry.name.replace('弁当', '')}${entry.qty}`)
    .join('・');

  return (
    <div className="mb-4 rounded-kb border border-line bg-paper">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex min-h-[48px] w-full items-center gap-2 px-3.5 text-left"
      >
        <span className="flex-1 font-bold text-[0.9rem]">
          🍱 弁当注文 計{meals}食{summary ? ` （${summary}）` : ''}
          {cancelledCount > 0 ? (
            <span className="ml-1 font-normal text-[0.74rem] text-ink-mute">
              キャンセル{cancelledCount}件
            </span>
          ) : null}
        </span>
        {unmatchedCount > 0 ? (
          <span className="flex items-center gap-1 text-[0.76rem] text-orange-deep">
            <AlertTriangle size={14} /> 未照合{unmatchedCount}件
          </span>
        ) : null}
        <span className="text-[0.72rem] text-ink-mute">{open ? '閉じる' : '詳細'}</span>
      </button>
      {open ? (
        <div className="border-line border-t px-3.5 pb-2">
          {visible.map((order) => (
            <OrderRow key={order.id} order={order} guests={nearbyGuests} onPick={setPicking} />
          ))}
        </div>
      ) : null}

      {picking ? (
        <div className="border-line border-t px-3.5 py-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="font-bold text-[0.84rem]">
              「{picking.items_label ?? ''}」（{picking.customer_name || '氏名なし'}）を誰に？
            </span>
            <button type="button" aria-label="閉じる" onClick={() => setPicking(null)}>
              <X size={16} className="text-ink-mute" />
            </button>
          </div>
          {nearbyGuests.length === 0 ? (
            <p className="text-[0.78rem] text-ink-light">前後2日に宿泊者が見つかりません。</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {nearbyGuests.map((guest) => (
                <button
                  key={guest.id}
                  type="button"
                  onClick={() => {
                    linkOrder(picking.id, guest.id);
                    setPicking(null);
                  }}
                  className="min-h-[40px] rounded-full border border-line px-3 text-[0.82rem]"
                >
                  {guest.name}
                  <span className="ml-1 text-[0.68rem] text-ink-mute">
                    {guest.stay_date === date ? '当日' : formatStayDate(guest.stay_date ?? '')}
                  </span>
                </button>
              ))}
            </div>
          )}
          <button
            type="button"
            onClick={() => {
              excludeOrder(picking.id);
              setPicking(null);
            }}
            className="mt-2 text-[0.76rem] text-ink-mute underline"
          >
            宿泊者ではない（対象外にする）
          </button>
        </div>
      ) : null}
    </div>
  );
}

// Chip shown on a guest's detail: their linked orders (parsed, compact).
export function guestOrderChip(orders: BentoOrderRow[]): string | null {
  const active = orders.filter((order) => isVisibleOrder(order) && !isCancelledOrder(order));
  if (active.length === 0) {
    return null;
  }
  const parts = active.flatMap((order) =>
    parseItems(order.items_json).map((item) => `${item.name.replace('弁当', '')}×${item.qty}`),
  );
  return parts.length > 0 ? parts.join('・') : null;
}
