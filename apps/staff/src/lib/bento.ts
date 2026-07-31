import type { BentoOrderRow } from './powersync/schema';

// Display/matching rules for the koguchi-bento order mirror
// (docs/plan-bento-integration.md §4/§5). Pure functions — unit-tested.

export interface BentoItem {
  slug: string;
  name: string;
  qty: number;
  /** 「特盛（ご飯+焼肉）」等。数え方は slug 単位のままなので集計には使わない。 */
  size: string | null;
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

const str = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() !== '' ? value : null;

// Product name, most trustworthy source first. The contract (§6) specified
// `name`, but production actually ships `name_ja` — every item rendered as
// 「不明な商品」 until this fallback existed. Falling back to the raw slug rather
// than a hardcoded slug→name table is deliberate: koguchi renames products
// (ヴィーガン弁当 → ベジタリアン弁当), and a stale local label would confidently
// show the WRONG product, which in this domain means handing a guest the wrong
// meal. 'yakiniku' is ugly but honest, and it makes a contract break visible.
function itemName(item: Record<string, unknown>): string {
  return str(item.name) ?? str(item.name_ja) ?? str(item.slug) ?? '不明な商品';
}

// Tolerant by design: this parses data from another system, so unknown or
// renamed keys must degrade to a readable line, never to an empty panel.
// Aggregation stays slug-based (see mealsBySlug), so a size variant still counts
// as one meal of its product — 計N食 is unaffected by any of this.
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
      .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
      .map((item) => ({
        slug: str(item.slug) ?? '',
        name: itemName(item),
        qty: typeof item.qty === 'number' && item.qty > 0 ? item.qty : 0,
        size: str(item.size_label) ?? str(item.sizeLabel),
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

// Loose name comparison for display only. koguchi sends reservation_name exactly
// as the customer typed it (no normalisation), so 「山田 太郎」 and 「山田太郎」 are
// the same person to a human. Fold width, kana case and all whitespace away
// before comparing — used to decide whether the booking name adds information,
// never to decide a match.
export function normalizeName(value: string | null | undefined): string {
  if (!value) {
    return '';
  }
  return value.normalize('NFKC').replace(/\s+/gu, '').toLowerCase();
}

// The booking name worth showing: present, and actually different from the payer
// name already on screen. Staff use it to find which stay an order belongs to.
export function reservationNameHint(order: BentoOrderRow): string | null {
  const reservation = order.reservation_name?.trim();
  if (!reservation) {
    return null;
  }
  return normalizeName(reservation) === normalizeName(order.customer_name) ? null : reservation;
}
