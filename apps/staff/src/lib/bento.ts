import type { BentoOrderRow } from './powersync/schema';

// Display/matching rules for the koguchi-bento order mirror
// (docs/plan-bento-integration.md §4/§5). Pure functions — unit-tested.

export interface BentoItem {
  slug: string;
  name: string;
  qty: number;
}

// Payment tags a staff manual entry carries (online orders have null).
const PAYMENT_LABELS: Record<string, string> = {
  ONSITE: '現地決済',
  CASH: '現金',
  BANK: '振込',
  OTHER: 'その他決済',
};

export function paymentLabel(method: string | null | undefined): string | null {
  if (!method) {
    return null;
  }
  return PAYMENT_LABELS[method] ?? method;
}

export function parseItems(itemsJson: string | null | undefined): BentoItem[] {
  if (!itemsJson) {
    return [];
  }
  try {
    const parsed = JSON.parse(itemsJson);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed
      .filter((item) => item && typeof item === 'object')
      .map((item) => ({
        slug: typeof item.slug === 'string' ? item.slug : '',
        name: typeof item.name === 'string' ? item.name : '不明な商品',
        qty: typeof item.qty === 'number' && item.qty > 0 ? item.qty : 0,
      }))
      .filter((item) => item.qty > 0);
  } catch {
    return [];
  }
}

// A PENDING that stopped updating >45min ago is presumed EXPIRED — insurance
// against a lost EXPIRED event (the source writes it explicitly, but pushes are
// best-effort).
const PENDING_GRACE_MS = 45 * 60_000;

export function isPresumedExpired(order: BentoOrderRow, now: Date = new Date()): boolean {
  if (order.status !== 'PENDING') {
    return false;
  }
  if (!order.source_updated_at) {
    return true;
  }
  const updated = Date.parse(order.source_updated_at);
  return Number.isNaN(updated) || now.getTime() - updated > PENDING_GRACE_MS;
}

// Orders staff act on: paid / confirmed (incl. manual entries) / invoiced.
const ACTIVE_STATUSES = new Set(['PAID', 'CONFIRMED', 'INVOICED']);
const CANCELLED_STATUSES = new Set(['CANCELLED', 'REFUNDED']);

export function isActiveOrder(order: BentoOrderRow): boolean {
  return ACTIVE_STATUSES.has(order.status ?? '');
}

export function isCancelledOrder(order: BentoOrderRow): boolean {
  return CANCELLED_STATUSES.has(order.status ?? '');
}

// What the day panel shows: active orders always; cancelled ones only when they
// were already linked to a guest (so staff notice the cancellation instead of
// preparing the bento); PENDING only while fresh (and never as actionable).
export function isVisibleOrder(order: BentoOrderRow, now: Date = new Date()): boolean {
  if (isActiveOrder(order)) {
    return true;
  }
  if (isCancelledOrder(order)) {
    return order.guest_id != null;
  }
  if (order.status === 'PENDING') {
    return !isPresumedExpired(order, now);
  }
  return false; // EXPIRED and anything unknown
}

// Unmatched = needs staff attention. Defined on guest_id (not match alone) so a
// deleted guest (FK sets guest_id null) resurfaces the order. INN rows are never
// actionable (aggregated inn orders carry no personal name), nor are cancelled/
// pending ones.
export function isUnmatched(order: BentoOrderRow): boolean {
  return (
    isActiveOrder(order) &&
    order.guest_id == null &&
    order.match !== 'excluded' &&
    order.channel !== 'INN'
  );
}

// Meal totals by product slug over the ACTIVE orders only.
export function totalMeals(orders: BentoOrderRow[]): number {
  return orders
    .filter(isActiveOrder)
    .flatMap((order) => parseItems(order.items_json))
    .reduce((sum, item) => sum + item.qty, 0);
}

export function mealsBySlug(
  orders: BentoOrderRow[],
): Array<{ slug: string; name: string; qty: number }> {
  const bucket = new Map<string, { slug: string; name: string; qty: number }>();
  for (const order of orders.filter(isActiveOrder)) {
    for (const item of parseItems(order.items_json)) {
      const key = item.slug || 'other';
      const entry = bucket.get(key);
      if (entry) {
        entry.qty += item.qty;
      } else {
        // Keep the first-seen name as the display name; unknown slugs still count.
        bucket.set(key, { slug: key, name: item.name, qty: item.qty });
      }
    }
  }
  return [...bucket.values()].filter((entry) => entry.qty > 0);
}

export function hasPartialRefund(order: BentoOrderRow): boolean {
  return order.status === 'PAID' && (order.refunded_yen ?? 0) > 0;
}
